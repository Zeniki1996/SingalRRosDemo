import React, { useState, useEffect, useRef} from "react";
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
  const [sentimentStatus, setSentimentStatus] = useState("En espera de pregunta");
  const [state, setState] = useState("Loading");
  const [image, setImage] = useState(images.abierto);
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const { sendCommand, connectionState, on } =
    useSignalRConnection("/robot-hub");
  const [answer, setAnswer] = useState("");
  const timeoutRef = useRef(null);

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
    let imageSequence = [];
    let timeSequence = [];
    
    switch (sentimentStatus) {
      case "En espera de pregunta":
        imageSequence =  [images.abierto, images.abierto, images.feliz, images.abierto,  images.feliz, images.abierto, images.feliz, images.abierto];
        timeSequence = [2000, 1500, 1000, 6000, 1000, 8000, 1000,10000];
        break;
      case "Error":
        imageSequence = [images.cansado,images.triste];
        timeSequence = [5200, 10000];
        break;
      case "Escuchando":
        imageSequence = [images.burla, images.abierto, images.feliz, images.abierto];
        timeSequence = [2000, 4000, 1000, 3000];
        break;
      case "Pensando":
        imageSequence = [images.pensando];
        timeSequence = [6000];
        break;
        case "fin":
        imageSequence = [images.guino, images.burla];
        timeSequence = [3000, 2000];
        break;
        case "Respondiendo":
          imageSequence = [images.feliz, images.burla];
          timeSequence = [6000, 3000];
          break;
      default:
        imageSequence = [images.enojado];
        timeSequence = [10000];
    }
  
  
    let index = 0;

    const loopSequence = () => {
      setImage(imageSequence[index]); // Cambiar la imagen actual

      // Almacenar el ID del timeout en la referencia
      timeoutRef.current = setTimeout(() => {
        index = (index + 1) % imageSequence.length; // Resetear índice cuando llegue al final
        loopSequence(); // Llamar de nuevo para continuar la secuencia
      }, timeSequence[index]); // Usar el tiempo correspondiente para cada imagen
    };

    loopSequence(); // Iniciar la secuencia de imágenes

    // Limpiar el timeout cuando el componente se desmonte o cambie el estado
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current); // Limpiar el timeout
      }
    };
  }, [sentimentStatus]);
  

  useEffect(() => {
    const initPorcupineListening = async () => {
      try {
        const accessKey = 'VWT3TYOOFPWEXfhrMMXYZkqp3+hV9As1S1D5r2zGnDyjyHD2aHu+/g==';
        console.log("Variable de entorno viendo si funca",process.env);
        console.log("BACKEND_URL:", process.env.REACT_APP_BACKEND_URL);
        console.log("OPENAI_API_KEY:", process.env.REACT_APP_OPENAI_API_KEY);

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
          setSentimentStatus("En espera de pregunta");
          break;

        case "Listening":
          onListening();
          setSentimentStatus("Escuchando");
          break;

        case "Waiting Backend":
          onWaitingBackend();
          setSentimentStatus("Pensando");
          break;

        case "Speaking":
          onSpeaking();
          setSentimentStatus("Respondiendo");
          break;

        case "ExpectIfContinue":
          onExpectIfContinue();
          setSentimentStatus("En espera de pregunta");
          break;

        case "Continue":
          onContinue();
          setSentimentStatus("Respondiendo");
          break;

        case "Goodbye":
          onGoodbye();
          setSentimentStatus("Fin");
          break;

        case "Error":
          onError();
          setSentimentStatus("Error");
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

 /* useEffect(() => {
    let interval;
    if (sentimentStatus === "En espera de pregunta" || sentimentStatus === "No detecta") {
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
  }, [sentimentStatus]);*/

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
  const parts = textToSpeak.match(/[\s\S]{1,190}\.?/g) || [textToSpeak];
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




  async function listen(callback) {
    if (!browserSupportsSpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz");
      return;
    }
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
  }

  async function onWaitingBackend() {
    console.log("Waiting Backend");
    var question = transcript.trim();
    setAnswer(question);
    console.log("pregunta: ", question);
    resetTranscript();

    if (question === "") {
      setState("Goodbye");
      return;
    }

    const [error, answer] = await answerQuestion(question);

    if (error || answer === "") {
      console.error("Error al llamar a la API:", error);
    }

    console.log("Respuesta del backend:", answer);
    setAnswer(answer);
    setState("Speaking");
  }

  async function onSpeaking() {
    console.log("Speaking");
    speak(answer, () => {
      console.log("Finished speaking");
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
    }

    console.log("Respuesta del backend:", answer);
    setAnswer(answer);
    setState("Speaking");
  }

  async function onGoodbye() {
    console.log("Goodbye");
    setAnswer(""); 
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