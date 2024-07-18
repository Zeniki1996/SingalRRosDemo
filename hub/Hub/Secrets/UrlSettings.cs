namespace Hub.Secrets
{
    public class UrlSettings
    {
        public const string SectionName = "Urls";
        public required string AzureOpenAI { get; init; }
        public required string AzureSearch { get; init; }
    }
}
