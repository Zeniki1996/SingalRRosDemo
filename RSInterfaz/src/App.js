import React, { useState, useEffect, useCallback } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { usePorcupine } from "@picovoice/porcupine-react";
import "./App.css";
import { BotIcon, EyeIcon, MicIcon, MonitorSmartphoneIcon, StopCircleIcon } from "lucide-react";

// Importar los archivos .ppn y .pv usando rutas relativas
import holaMaviKeywordPath from "./hola-mavi/Hola-Mavi_es_wasm_v3_0_0.ppn";
import holaMaviModel from "./hola-mavi/porcupine_params_es.pv";

// Imágenes utilizadas en el estado de la aplicación
const images = {
  abierto: require("./images/abierto.png"),
  feliz: require("./images/feliz.png"),
  cansado: require("./images/cansado.png"),
  enojado: require("./images/enojado.png"),
  guino: require("./images/guiño.png"),
  pensando: require("./images/pensando.png"),
  triste: require("./images/triste.png"),
  burla: require("./images/burla.png")
};

const SpeechToTextComponent = () => {
  const [text, setText] = useState(""); // Estado para almacenar el texto reconocido
  const [status, setStatus] = useState("En espera"); // Estado para manejar el estado del reconocimiento de voz
  const [image, setImage] = useState(images.abierto); // Estado para manejar la imagen actual
  const [wakeWordDetected, setWakeWordDetected] = useState(false); // Estado para manejar la detección de la palabra clave
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition(); // Hook para el reconocimiento de voz

  const {
    keywordDetection,
    init,
    start,
    stop,
    release,
  } = usePorcupine();

  // Envío de comandos por el SignalR al robot
  const sendCommand = async (command) => {
    if (connection && connection.state === "Connected") {
      try {
        await connection.send("SendRobotCommand", command);
      } catch (e) {
        console.log(e);
      }
    } else {
      alert("No connection to server yet.");
    }
  };

  // Estado de conexión para SignalR
  const [connection, setConnection] = useState(null);

  const handleStop = useCallback(() => {
    SpeechRecognition.stopListening();
    const finalTranscript = transcript.trim();
  
    setText(finalTranscript);
    resetTranscript();

    if (finalTranscript) {
      setStatus("Pensando");
      setImage(images.pensando);
  
      // Enviar el texto reconocido al backend
      fetch("https://robotappservice.azurewebsites.net/chat/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: finalTranscript }),
      })
        .then((response) => response.json())
        .then((data) => {
          const responseText = data.answer;
          console.log("Respuesta del backend:", responseText);
          handleSpeak(responseText);
        })
        .catch((error) => {
          console.error("Error al llamar a la API:", error);
          setStatus("En espera");
          setImage(images.abierto);
        });
    } else {
      alert("No se detectó contenido de la voz");// por que en la segunda vez no responde 
      setStatus("En espera");
      setImage(images.abierto);
    }
  }, [transcript, resetTranscript]);

  const handleListen = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz");
      return;
    }
  
    setStatus("Escuchando");
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true, language: "es-ES" });
    

    const recognition = SpeechRecognition.getRecognition();
    recognition.onend = () => {
      console.log("Reconocimiento de voz finalizado. Deteniendo escucha...");
      handleStop();
    };
  }, [browserSupportsSpeechRecognition, resetTranscript, handleStop]);

  useEffect(() => {
    // Crear una nueva conexión de SignalR
    const newConnection = new HubConnectionBuilder()
      .withUrl("https://robotappservice.azurewebsites.net/robot-hub")
      .withAutomaticReconnect()
      .build();

    newConnection.on("RecibirData", (dataType, data) => {
      // Hacer algo con los datos del robot
      console.log(dataType, data);
    });

    setConnection(newConnection);
  }, []);

  // Establecer la conexión de SignalR
  useEffect(() => {
    if (connection && !connection.connectionStarted) {
      connection
        .start()
        .then(() => console.log("Connected!"))
        .catch((e) => console.log("Connection failed: ", e));
    }
  }, [connection]);

  // Inicializar Porcupine
  useEffect(() => {
    const initPorcupine = async () => {
      try {
        const accessKey = process.env.REACT_APP_PORCUPINE_KEY; // Asegúrate de que la clave esté configurada en .env.local

        await init(
          accessKey,
          [{ label: "Hola Mavi", publicPath: holaMaviKeywordPath }],
          {
            publicPath: holaMaviModel,
          }
        );
        await start();
        console.log("Porcupine initialized and started listening");
      } catch (error) {
        console.error("Error initializing Porcupine:", error);
      }
    };

    initPorcupine();

    return async () => {
      await stop();
      await release();
    };
  }, [init, start, stop, release]);

  useEffect(() => {
    if (keywordDetection !== null) {
      console.log("Wake word detected:", keywordDetection);
      setWakeWordDetected(true);
      sendCommand("/OFF");
    }
  }, [keywordDetection]);

  useEffect(() => {
    if (wakeWordDetected) {
      handleListen();
      setWakeWordDetected(false);
    }
  }, [wakeWordDetected]);

  // Efecto para manejar el cambio de imagen en base al estado
  useEffect(() => {
    let interval;
    if (status === "En espera") {
      interval = setInterval(() => {
        setImage((prevImage) =>
          prevImage === images.abierto ? images.feliz : images.abierto
        );
      }, 2500); // 2.5s abierto, 2.5s feliz
    }
    return () => clearInterval(interval); // Limpieza del intervalo cuando el componente se desmonta o el estado cambia
  }, [status]);

  const handleSpeak = useCallback((textToSpeak) => {
    if (textToSpeak && textToSpeak.trim()) {
      setStatus("Hablando...");
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "es-ES";

      utterance.onend = () => {
        if (isWaitingForResponse) {
          setImage(images.cansado);
          setTimeout(() => {
            start();
            sendCommand("/ON");
          }, 1000);
        } else {
          setImage(images.abierto);
          start();
          sendCommand("/ON");
        }
      };
      window.speechSynthesis.speak(utterance);
    } else {
      //alert("No hay contenido en el cuadro de texto");
    }
  }, [isWaitingForResponse]);

  const handleConversationFlow = () => {
    setIsWaitingForResponse(true);

    if (transcript.toLowerCase().includes("no")) {
      handleSpeak("Gracias, hasta luego.");
      setIsWaitingForResponse(false);
    } else if (transcript.toLowerCase().includes("sí")) {
      handleSpeak("¿En qué te puedo ayudar?");
      setIsWaitingForResponse(false);
    } else {
      handleSpeak("Disculpa, no te entendí. ¿Te puedo ayudar en algo más?");
    }
  };

  return (
    <div className="centered">
      <div className="pixel-art-container">
      <div className="Margenimagen">
      <img src={image} alt="Estado actual" className="state-image" />
      </div>
        <div className="pixel-art">
          <textarea
            rows="2"
            cols="50"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="button-container">
            <button onClick={handleListen}>
              <MicIcon size={30} />
            </button>
            <button onClick={handleStop}>
            <StopCircleIcon size={30} />
            </button>
          </div>
        </div>
      </div>
      <span style={{ color: "white" }}>{status}</span>
    </div>
  );
};

const App = () => {
  return (
    <div className="background">
      <SpeechToTextComponent />
    </div>
  );
};

export default App;
