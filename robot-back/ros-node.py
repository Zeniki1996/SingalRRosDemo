from signalrcore.hub_connection_builder import HubConnectionBuilder
import logging

def on_command_received(command):
    test = command[0];
    print(f'Command received: {test}')



def main():
    hub_url = 'https://robotappservice.azurewebsites.net/robot-hub'
    hub_connection = HubConnectionBuilder()\
        .with_url(hub_url)\
        .configure_logging(logging.DEBUG)\
        .build()
        
    status_updates = {
        "Battery": "Connected",
        "Lidar": "Connected",
        "Arduino": "Connected",
        "Motors": "Connected",
        "UltrasonicSensor": "Connected"
    }

    hub_connection.on('ReceiveCommand', on_command_received) # Register a callback to be called when a message is received from the server
    
    hub_connection.on_open(lambda: [
        hub_connection.invoke("SendRobotStatus", component, status)
        for component, status in status_updates.items()
    ])
       
    hub_connection.start()

    input("Press <ENTER> to exit...\n")
    hub_connection.stop()
   
   # Función para manejar comandos recibidos (definirla según sea necesario)
def on_command_received(command):
    print(f"Command received: {command}")

if __name__ == "__main__":
    main()
