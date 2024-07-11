using Hub;
using Hub.Endpoints;
using Hub.Secrets;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

builder.Services.AddSignalR();
builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();

builder.Services.AddCors(setup =>
{
    setup.AddPolicy("Policy", policy => policy
        .AllowAnyHeader()
        .AllowAnyMethod()
        .SetIsOriginAllowed((host) => true)
        .AllowCredentials());
});

var urlSection = configuration.GetSection(UrlSettings.SectionName);
builder.Services.Configure<UrlSettings>(urlSection);

var secretSection = configuration.GetSection(SecretSettings.SectionName);
builder.Services.Configure<SecretSettings>(secretSection);

builder.Services.AddHttpClient();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseCors("Policy");

app.MapControllers();
app.MapChatEndpoint();

app.MapHub<RobotHub>("/robot-hub");

await app.RunAsync();