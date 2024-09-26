import { useState, useEffect, useCallback } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";

async function answerQuestion(question) {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}/chat/answer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: question }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to answer question: ${response.status} ${response.statusText}`);
        }

    const data = await response.json();
    return [null, data.answer];
  } catch (e) {
      console.error("Error fetching answer:", e.message);
      return [e.message, null];
  }
}

const useSignalRConnection = (hub) => {
  const [connection, setConnection] = useState(null);
  const [connectionState, setConnectionState] = useState("Disconnected");

  useEffect(() => {
    async function startConnection() {
      try {
        console.log("Connecting to hub: ", hub);
        const newConnection = new HubConnectionBuilder()
          //.withUrl(`${process.env.REACT_APP_BACKEND_URL}/${hub}`)
          .withUrl(`${process.env.REACT_APP_BACKEND_URL}/robot-hub`)
          .withAutomaticReconnect()
          .build();

          newConnection.onclose(() => {
            console.log("Connection closed");
            setConnectionState("Disconnected");
        });
        newConnection.onreconnecting(() => {
            console.log("Reconnecting...");
            setConnectionState("Reconnecting");
        });
        newConnection.onreconnected(() => {
            console.log("Reconnected");
            setConnectionState("Connected");
        });

        await newConnection.start();
        setConnection(newConnection);
        setConnectionState("Connected");
      } catch (e) {
        console.log("Error useSignalRConnection -> startConnection: ", e);
      }
    }

    if (!connection) {
      startConnection();
    }
    return () => {
      if (connection) {
        connection?.stop();
        setConnection(null);
      }
    };
  }, [hub, connection]);

  

  const sendCommand = useCallback(async (command) => {
    if (connection && connectionState === "Connected") {
      try {
          await connection.send("SendRobotCommand", command);
      } catch (error) {
          console.error("Error sending command: ", error);
      }
  } else {
      console.error("No connection to server yet.");
  }
}, [connection, connectionState]);

const on = useCallback((event, callback) => {
  connection?.on(event, callback);
}, [connection]);

  return { connection, connectionState, sendCommand, on };
};

export { answerQuestion, useSignalRConnection };
