

using Microsoft.AspNetCore.SignalR;

namespace Hub;

public sealed class RobotHub : Microsoft.AspNetCore.SignalR.Hub
{
    private readonly ILogger<RobotHub> _logger;

    public RobotHub(ILogger<RobotHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation($"Client {Context.ConnectionId} joined");
        await base.OnConnectedAsync();
        await SendRobotCommand("/CONNECTED");
    }

    public async Task SendRobotCommand(string command) 
    {
        _logger.LogInformation($"{Context.ConnectionId} with message '{command}'");
        await Clients.All.SendAsync("ReceiveCommand", command);
    }

    public async Task SendData(string dataType, object data)
    {
        _logger.LogInformation("{@ConnectionId} send data with type {@DataType} and data {@Data}", Context.ConnectionId, dataType, data);
        await Clients.All.SendAsync("RecibirData", dataType, data);
    }
}
