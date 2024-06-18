using Hub;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddControllers();

builder.Services.AddCors(setup =>
{
    setup.AddPolicy("Policy", policy => policy
        .AllowAnyHeader()
        .AllowAnyMethod()
        .SetIsOriginAllowed((host) => true)
        .AllowCredentials());
});

var app = builder.Build();

app.UseHttpsRedirection();

app.UseCors("Policy");

app.MapControllers();
app.MapHub<RobotHub>("/robot-hub");

await app.RunAsync();