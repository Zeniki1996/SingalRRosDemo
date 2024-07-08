import time
from signalrcore.hub_connection_builder import HubConnectionBuilder
import logging
import threading

hub_url = 'http://localhost:5118/robot-hub'
hub_connection = HubConnectionBuilder()\
    .with_url(hub_url)\
    .configure_logging(logging.DEBUG)\
    .build()


def on_command_received(command):
    test = command[0];
    print(f'Command received: {test}')

def send_robot_data():
    data = {
        "batteryLifePercentage": 89,
        "sensorPerformance": "Good",
        "isOn": True,
        "otherData": "Some other data",
    }

    # Simula el envio de informacion desde ros
    while True:

        data["batteryLifePercentage"] -= 1
        data["sensorPerformance"] = "Good" if data["batteryLifePercentage"] > 50 else "Bad"
        if data["batteryLifePercentage"] < 0:
            data["batteryLifePercentage"] = 100

        hub_connection.send("SendData", ["RobotData", data])

        time.sleep(5) # Para el hilo para enviar cada 5 segundos la data.

def main():

    hub_connection.on('ReceiveCommand', on_command_received) # Register a callback to be called when a message is received from the server
    hub_connection.start()

    hilo_data = threading.Timer(5, function=send_robot_data)
    hilo_data.daemon = True
    hilo_data.start()

    input("Press <ENTER> to exit...\n")
    hub_connection.stop()

if __name__ == "__main__":
    main()
