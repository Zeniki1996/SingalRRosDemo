import { useEffect, useState } from "react";
import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";

const RobotSender = () => {
  const [connection, setConnection] = useState<HubConnection | null>(null);

  useEffect(() => {
    const newConnection = new HubConnectionBuilder()
      .withUrl("http://localhost:5118/robot-hub")
      .withAutomaticReconnect()
      .build();

    newConnection.on("RecieveData", (dataType, data) =>
      console.log(dataType, data)
    );

    setConnection(newConnection);
  }, []);

  useEffect(() => {
    if (connection) {
      connection
        .start()
        .then(() => console.log("Connected!"))
        .catch((e) => console.log("Connection failed: ", e));
    }
  }, [connection]);

  const sendCommand = async (command: string) => {
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

  return (
    <div>
      <h1>Robot Command Sender</h1>
      <button onClick={() => sendCommand("/ON")}>Turn On</button>
      <button onClick={() => sendCommand("/OFF")}>Turn Off</button>
    </div>
  );
};

export default RobotSender;
