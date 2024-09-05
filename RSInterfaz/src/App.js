import React, { useState, useEffect } from "react";
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

const palabrasAfirmacion = [
  "sí",
  "si",
  "claro",
  "por supuesto",
  "adelante",
  "ok",
];

const SpeechToTextComponent = () => {
  const [sentimentStatus, setSentimentStatus] = useState("En Espera");
  const [state, setState] = useState("Loading");
  const [image, setImage] = useState(images.abierto);
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const { sendCommand, connectionState, on } =
    useSignalRConnection("robot-hub");
  const [answer, setAnswer] = useState("");

  const {
    keywordDetection,
    init: initPorcupine,
    start: startPorcupine,
    stop: stopPorcupine,
    release: releasePorcupine,
  } = usePorcupine();

  useEffect(() => {
    if (connectionState === "Connected") {
      on("RecibirData", (data) => {
        //Hacer algo con la data recibida del robot
        console.log("Data received: ", data);
      });

      setState("Moving");
    }
  }, [connectionState]);

  useEffect(() => {
    switch (sentimentStatus) {
      case "En espera":
        setImage(images.abierto);
        break;
      case "No detecta":
        setImage(images.abierto);
        break;
      case "Escuchando":
        setImage(images.abierto);
        break;
      case "Pensando":
        setImage(images.pensando);
        break;
      case "Hablando":
        setImage(images.cansado);
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
  }, [initPorcupine, startPorcupine, stopPorcupine, releasePorcupine]);

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
      interval = setInterval(() => {
        setImage((prevImage) =>
          prevImage === images.abierto ? images.feliz : images.abierto
        );
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [sentimentStatus]);

  function speak(textToSpeak, callback) {
    if (!textToSpeak || textToSpeak.trim() === "") {
      return;
    }

    setSentimentStatus("Hablando");
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "es-ES";
    utterance.onend = () => {
      callback();
    };
    window.speechSynthesis.speak(utterance);
  }

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
    }, 6000); //6 seconds timeout to stop listening;
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
  }

  async function onWaitingBackend() {
    console.log("Waiting Backend");
    var question = transcript.trim();
    resetTranscript();

    if (question === "") {
      setState("Goodbye");
      return;
    }

    const [error, answer] = await answerQuestion(question);

    if (error || answer === "") {
      console.error("Error al llamar a la API:", error);
      setSentimentStatus("En espera");
    }

    console.log("Respuesta del backend:", answer);
    setAnswer(answer);
    setState("Speaking");
  }

  async function onSpeaking() {
    console.log("Speaking");
    speak(answer, () => setState("ExpectIfContinue"));
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
    let shouldContinue = false;
    palabrasAfirmacion.forEach((palabra) => {
      if (toContinue.toLowerCase().includes(palabra)) {
        shouldContinue = true;
      }
    });

    if (shouldContinue) {
      setState("Listening");
    } else {
      setState("Goodbye");
    }
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
