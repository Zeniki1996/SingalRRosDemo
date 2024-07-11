namespace Hub.Secrets
{
    public class SecretSettings
    {
        public const string SectionName = "Secrets";
        public required string AzureOpenAIKey { get; init; }
        public required string AzureAISearchKey { get; init; }
    }
}
