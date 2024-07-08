from signalrcore.hub_connection_builder import HubConnectionBuilder
import logging

def on_command_received(command):
    test = command[0];
    print(f'Command received: {test}')

def main():
    hub_url = 'https://hubapprs.azurewebsites.net/robot-hub'
    hub_connection = HubConnectionBuilder()\
        .with_url(hub_url)\
        .configure_logging(logging.DEBUG)\
        .build()

    hub_connection.on('ReceiveCommand', on_command_received) # Register a callback to be called when a message is received from the server

    hub_connection.on_open(lambda: hub_connection.send('SendData', ['Hola'])) # Send a message to the server when the connection is opened

    hub_connection.start()

    input("Press <ENTER> to exit...\n")
    hub_connection.stop()

if __name__ == "__main__":
    main()
