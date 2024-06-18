from signalrcore.hub_connection_builder import HubConnectionBuilder
import logging

def on_command_received(command):
    test = command[0];
    print(f'Command received: {test}')

def main():
    hub_url = 'http://localhost:5118/robot-hub'
    hub_connection = HubConnectionBuilder()\
        .with_url(hub_url)\
        .configure_logging(logging.DEBUG)\
        .build()

    hub_connection.on('ReceiveCommand', on_command_received)
    hub_connection.start()

    input("Press <ENTER> to exit...\n")
    hub_connection.stop()

if __name__ == "__main__":
    main()
