import React, { useState, useEffect} from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { usePorcupine } from "@picovoice/porcupine-react";

import "./App.css";
import { MicIcon, StopCircleIcon } from "lucide-react";
import { answerQuestion, useSignalRConnection } from "./utils/backend";

// Importar los archivos .ppn y .pv usando rutas relativas
import holaMaviKeywordPath from "./mavi/Hola-Mavi_es_wasm_v3_0_0.ppn";
import holaMaviModel from "./mavi/porcupine_params_es.pv";

// Imágenes utilizadas en el estado de la aplicación
const images = {
  abierto: require(`./images/abierto.png`),
  feliz: require(`./images/feliz.png`),
  cansado: require(`./images/cansado.png`),
  enojado: require(`./images/enojado.png`),
  guino: require(`./images/guiño.png`),
  pensando: require(`./images/pensando.png`),
  triste: require(`./images/triste.png`),
  burla: require(`./images/burla.png`),
};

/*
ESTADOS DE LA MAQUINA:
0. Loading
1. Moving
2. Listening
3. Waiting Backend
4. Speaking
5. ExpectIfContinue
7. Continue
6. Goodbye
*. Error
*/

const palabrasNegación = [
  "no",
  "nó",
  "Para nada"
];

const SpeechToTextComponent = () => {
  const [sentimentStatus, setSentimentStatus] = useState("En Espera");
  const [state, setState] = useState("Loading");
  const [image, setImage] = useState(images.abierto);
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const { sendCommand, connectionState, on } =
    useSignalRConnection("/robot-hub");
  const [answer, setAnswer] = useState("");

  const {
    keywordDetection,
    init: initPorcupine,
    start: startPorcupine,
    stop: stopPorcupine,
    release: releasePorcupine,
    error: errorporcupine,
  } = usePorcupine();

  useEffect(() => {
   console.log("Error: ",errorporcupine);
  }, [errorporcupine]);

  useEffect(() => {
    if (connectionState === "Connected") {
      on("RecibirData", (data) => {
        //Hacer algo con la data recibida del robot
        console.log("Data received: ", data);
      });

      setState("Moving");
    }
  }, [connectionState,on]);

  useEffect(() => {
    switch (sentimentStatus) {
      case "En espera":
        setImage(images.abierto);
        break;
      case "No detecta":
        setImage(images.cansado);
        break;
      case "Escuchando":
        setImage(images.burla);
        break;
      case "Pensando":
        setImage(images.pensando);
        break;
      case "Hablando":
        setImage(images.feliz);
        break;
      default:
        setImage(images.abierto);
        break;
    }
  }, [sentimentStatus]);

  useEffect(() => {
    const initPorcupineListening = async () => {
      try {
        const accessKey = process.env.REACT_APP_PORCUPINE_KEY;

        await initPorcupine(
          accessKey,
          [{ label: "Hola Mavi", publicPath: holaMaviKeywordPath }],
          {
            publicPath: holaMaviModel,
          }
        );
        console.log("Porcupine initialized");
      } catch (error) {
        console.error("Error initializing Porcupine:", error);
      }
    };

    initPorcupineListening();

    return () => {
      releasePorcupine();
    };
  }, []);

  useEffect(() => {
    const checkState = async () => {
      switch (state) {
        case "Loading":
          console.log("Loading...");
          break;

        case "Moving":
          onMoving();
          break;

        case "Listening":
          onListening();
          break;

        case "Waiting Backend":
          onWaitingBackend();
          break;

        case "Speaking":
          onSpeaking();
          break;

        case "ExpectIfContinue":
          onExpectIfContinue();
          break;

        case "Continue":
          onContinue();
          break;

        case "Goodbye":
          onGoodbye();
          break;

        case "Error":
          onError();
          break;

        default:
          throw new Error("Estado no reconocido");
      }
    };
    checkState();
  }, [state]);

  useEffect(() => {
    if (keywordDetection !== null) {
      console.log("Wake word detected:", keywordDetection);
      setState("Listening");
    }
  }, [keywordDetection, setState]);

  useEffect(() => {
    let interval;
    if (sentimentStatus === "En espera" || sentimentStatus === "No detecta") {
      let count = 0;
      let isOpen = true; 
      interval = setInterval(() => {
        if (count < 6) {  // Total de cambios (3 ciclos de abrir y feliz)
          setImage(isOpen ? images.feliz : images.abierto);
          isOpen = !isOpen;  // Cambia el estado de los ojos
          count++;
          } else {
              clearInterval(interval);  // Limpia el intervalo después de completar la secuencia
              setImage(images.abierto);  // Asegura que los ojos terminen abiertos
          }
      }, 500); 
    }
    return () => clearInterval(interval);
  }, [sentimentStatus]);

  /*function speak(textToSpeak, callback) {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (!textToSpeak || textToSpeak.trim() === "") {
      return;
    }

    setSentimentStatus("Hablando");
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "es-ES";

       utterance.onend = () => {
    console.log("Finalizó de hablar");
    if (callback) callback();
  };
 
   utterance.onerror = (event) => {
    console.error("Error al hablar: ", event.error);
    // Manejo específico para el error 'not-allowed'
    if (event.error === "not-allowed") {
      setSentimentStatus("Error al Hablar");
      console.error("La síntesis de voz no está permitida. Verifica los permisos del navegador.");
    }
  };

  utterance.onboundary = (event) => {
    console.log("Se ha leído la palabra en la posición:", event.charIndex);
  };

    window.speechSynthesis.speak(utterance);

  }*/
    // Hook de React para manejar el estado de si está hablando
const [isSpeaking, setIsSpeaking] = useState(false);

// Función para hablar textos divididos en partes
function speak(textToSpeak, callback) {
  // Dividir el texto en partes manejables
  const parts = textToSpeak.match(/[\s\S]{1,200}\.?/g) || [textToSpeak];
  let partIndex = 0;

  const speakNextPart = () => {
    if (partIndex < parts.length) {
        const utterance = new SpeechSynthesisUtterance(parts[partIndex]);
        utterance.lang = "es-ES";

        utterance.onend = () => {
            partIndex++;
            if (partIndex < parts.length) {
                setTimeout(speakNextPart, 250);  // Pausa breve entre partes
            } else {
                setIsSpeaking(false);
                if (callback) callback();
            }
        };

        utterance.onerror = (event) => {
          console.error("Error al hablar: ", event.error);
          setIsSpeaking(false);
        };
  
        window.speechSynthesis.speak(utterance);
      }
    };
  // Solo inicia si no está ya hablando
  if (!isSpeaking) {
    setIsSpeaking(true);
    speakNextPart();
}
}



    
//Fin prueba 
  async function listen(callback) {
    if (!browserSupportsSpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz");
      return;
    }
    setSentimentStatus("Escuchando");
    await SpeechRecognition.startListening({
      continuous: true,
      language: "es-ES",
    });
  
    setTimeout(() => {
      SpeechRecognition.stopListening().then(() => {
        callback();
      });
    }, 5000); //5 seconds timeout to stop listening;
  }

  async function onMoving() {
    console.log("Moving");
    await sendCommand("/ON");
    await startPorcupine();
    console.log("Porcupine started");
  }

  async function onListening() {
    console.log("Listening");
    await sendCommand("/OFF");
    await stopPorcupine();
    await listen(() => setState("Waiting Backend"));
    setSentimentStatus("Escuchando");
    setImage(images.cansado);

  }

  async function onWaitingBackend() {
    console.log("Waiting Backend");
    setSentimentStatus("Conectando a la base de conocimiento ");
    setImage(images.pensando);
    var question = transcript.trim();
    resetTranscript();

    if (question === "") {
      setState("Goodbye");
      setImage(images.guino);
      return;
    }

    const [error, answer] = await answerQuestion(question);

    if (error || answer === "") {
      console.error("Error al llamar a la API:", error);
      setSentimentStatus("Error");
      setImage(images.cansado);
    }

    console.log("Respuesta del backend:", answer);
    setAnswer(answer);
    setState("Speaking");
    setImage(images.triste);
  }

  async function onSpeaking() {
    console.log("Speaking");
    speak(answer, () => {
      console.log("Finished speaking");
      setImage(images.guino);
      setState("ExpectIfContinue");
  });
    //speak(answer, () => setState("ExpectIfContinue"));
  }

  async function onExpectIfContinue() {
    console.log("ExpectIfContinue");
    await listen(() => setState("Continue"));
  }

  async function onContinue() {
    const toContinue = transcript.trim();
    resetTranscript();

    console.log("Continuar? ", toContinue);

    //si la respuesta contine palabras de afirmación
    let shouldContinue = true;
    palabrasNegación.forEach((palabra) => {
      if (toContinue.toLowerCase().includes(palabra)) {
        shouldContinue = false;
      }
    });

    if (toContinue === "" || !shouldContinue){
      setState("Goodbye");
      return ;
    }
    const [error, answer] = await answerQuestion(toContinue);

    if (error || answer === "") {
      console.error("Error al llamar a la API:", error);
      setSentimentStatus("En espera");
    }

    console.log("Respuesta del backend:", answer);
    setAnswer(answer);
    setState("Speaking");
  }

  async function onGoodbye() {
    console.log("Goodbye");
    speak("De acuerdo, Adiós!", () => setState("Moving"));
  }

  async function onError() {
    console.log("Error");
    speak("Lo siento, ha ocurrido un error", () => setState("Moving"));
  }

  if (state === "Loading") {
    return <div className="centered">Cargando...</div>;
  }

  return (
    <div className="centered">
      <div className="pixel-art-container">
        <div className="Margenimagen">
          <img src={image} alt="Estado actual" className="state-image" />
        </div>
        <div className="pixel-art">
          <textarea rows="2" cols="50" value={answer} readOnly />
          <div className="button-container">
            <button onClick={() => setState("Listening")}>
              <MicIcon size={30} />
            </button>
            <button onClick={() => window.speechSynthesis.cancel()}>
              <StopCircleIcon size={30} />
            </button>
          </div>
        </div>
      </div>
      <span style={{ color: "white" }}>{sentimentStatus}</span>
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