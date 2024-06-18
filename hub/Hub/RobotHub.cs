

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

    public async Task SendData(string rendimiento)
    {
        _logger.LogInformation($"{Context.ConnectionId} with message '{rendimiento}'");
        await Clients.All.SendAsync("ReciBirDatas", rendimiento);
    }
}
