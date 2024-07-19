import React, { useState, useEffect, useRef, useCallback } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { BuiltInKeyword, PorcupineWorker } from "@picovoice/porcupine-web";
import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { usePorcupine } from "@picovoice/porcupine-react";
import "./App.css";
import { MicIcon } from "lucide-react";

// Imágenes utilizadas en el estado de la aplicación
const images = {
  abierto: require("./images/abierto.png"),
  feliz: require("./images/feliz.png"),
  cansado: require("./images/cansado.png"),
  enojado: require("./images/enojado.png"),
  guino: require("./images/guiño.png"),
  pensando: require("./images/pensando.png"),
  triste: require("./images/triste.png"),
};

// Importar el archivo .ppn
const holaMaviKeywordPath = require("./hola-mavi/Hola-Mavi_es_wasm_v3_0_0.ppn"); //La frase es Hey ULI
const holaMaviModel = require("./hola-mavi/porcupine_params_es.pv");

const SpeechToTextComponent = () => {
  const [text, setText] = useState(""); // Estado para almacenar el texto reconocido
  const [status, setStatus] = useState("En espera"); // Estado para manejar el estado del reconocimiento de voz
  const [image, setImage] = useState(images.abierto); // Estado para manejar la imagen actual
  const [wakeWordDetected, setWakeWordDetected] = useState(false); // Estado para manejar la detección de la palabra clave
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition(); // Hook para el reconocimiento de voz

  const {
    keywordDetection,
    isLoaded,
    isListening,
    error,
    init,
    start,
    stop,
    release,
  } = usePorcupine();

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

  //Estado de conexión para SignalR
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    // Crear una nueva conexión de SignalR
    const newConnection = new HubConnectionBuilder()
      .withUrl("https://hubapprs.azurewebsites.net/robot-hub")
      .withAutomaticReconnect()
      .build();

    newConnection.on("RecibirData", (dataType, data) =>
      //Hacer algo con los datos del robot
      console.log(dataType, data)
    );

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
        const accessKey = process.env.REACT_APP_PORCUPINE_KEY; // Reemplaza con tu Access Key de Picovoice

        await init(
          accessKey,
          [{ label: "Hola Mavi", base64: holaMaviKeywordPath }],
          {
            publicPath: holaMaviModel,
          }
        );
        await start();
      } catch (error) {
        console.error("Error initializing Porcupine:", error);
      }
    };

    initPorcupine();

    return async () => {
      await stop();
      await release();
    };
  }, []);

  useEffect(() => {
    if (keywordDetection !== null) {
      setWakeWordDetected(true);
      sendCommand("/OFF");
    }
  }, [keywordDetection]);

  // Efecto para manejar el cambio de imagen en base al estado
  useEffect(() => {
    let interval;
    if (status === "En espera") {
      interval = setInterval(() => {
        setImage((prevImage) =>
          prevImage === images.feliz ? images.abierto : images.feliz
        );
      }, 2500); // 2s feliz, 0.5s abierto
    } else if (status === "Escuchando" || status === "Hablando") {
      interval = setInterval(() => {
        setImage((prevImage) =>
          prevImage === images.abierto ? images.feliz : images.abierto
        );
      }, 2500); // 2s abierto, 0.5s feliz
    }
    return () => clearInterval(interval); // Limpieza del intervalo cuando el componente se desmonta o el estado cambia
  }, [status]);

  useEffect(() => {
    if (wakeWordDetected) {
      handleListen();
      setWakeWordDetected(false); // Reset the wake word detected state
    }
  }, [wakeWordDetected]); //handlelisten añadido (si no funcciona correctamente eliminar esto)

  const handleListen = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz");
      return;
    }

    setStatus("Escuchando");
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true, language: "es-ES" });

    // Handle the end event when the user stops speaking
    const recognition = SpeechRecognition.getRecognition();
    recognition.onend = () => {
      setStatus("Pensando");
      console.log("Speech recognition ended");
      //handleStop();
    };
  }, [browserSupportsSpeechRecognition]);

  const handleStop = () => {
    SpeechRecognition.stopListening();
    setText(transcript);
    resetTranscript();

    if (transcript && transcript.trim()) {
      setStatus("Pensando");
      setImage(images.pensando);

      // Enviar el texto reconocido al backend
        fetch("https://hubapprs.azurewebsites.net/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: transcript }),
      })
        .then((response) => response.json())
        .then((data) => {
          const responseText = data.answer;
          console.log("Respuesta del backend:", responseText);
          setStatus("Hablando");
          handleSpeak(responseText);
        })
        .catch((error) => {
          console.error("Error al llamar a la API:", error);
          setStatus("En espera");
          setImage(images.abierto);
        });
    } else {
      alert("No se detectó contenido de la voz");
      setStatus("En espera");
      setImage(images.abierto);
    }
  };

  const handleSpeak = (textToSpeak) => {
    if (textToSpeak && textToSpeak.trim()) {
      setStatus("Hablando");
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "es-ES"; // Establecer el idioma a español
      utterance.onend = () => {
        setImage(images.guino);
        setTimeout(async () => {
          setStatus("En espera");
          setImage(images.abierto);
          // Reset to listening for wake word
          start();

          await sendCommand("/ON");
        }, 2000); // Cambiar la imagen a "guiño" por 2 segundos cuando termina de hablar
      };
      window.speechSynthesis.speak(utterance);
    } else {
      alert("No hay contenido en el cuadro de texto");
    }
  };

  return (
    <div className="centered">
      <div className="pixel-art-container">
        <img src={image} alt="Estado actual" className="state-image" />
        <div className="pixel-art">
          <textarea
            rows="4"
            cols="50"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="button-container">
            <button onClick={handleListen}>
              <MicIcon size={16} />
              <span>Speak</span>
            </button>
            <button onClick={handleStop}>Detener</button>
            <button onClick={() => handleSpeak(text)}>Hablar</button>
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
