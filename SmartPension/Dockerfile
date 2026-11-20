# Backend image for free hosting (Render, Koyeb, any Docker host). Build context = repository root.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/SmartPension.Api/SmartPension.Api.csproj backend/SmartPension.Api/
RUN dotnet restore backend/SmartPension.Api/SmartPension.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/SmartPension.Api/SmartPension.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
# Demo registry, imported on first start when Seed__RegistryCsv points to it.
COPY database/DEMO_pensioner_registry_200.csv database/
ENV PORT=8080
EXPOSE 8080
# Render/Koyeb set $PORT; listen on it (falls back to 8080).
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet SmartPension.Api.dll"]
