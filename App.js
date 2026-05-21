import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@last_weather_data";

export default function App() {
  const [appState, setAppState] = useState("loading");
  const [weatherData, setWeatherData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  const fetchWeather = useCallback(async () => {
    setAppState("loading");
    setErrorMessage("");
    setIsOffline(false);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setAppState("permission-denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,precipitation&hourly=temperature_2m,precipitation_probability,precipitation&forecast_days=2`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Błąd HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.current || !data.hourly) {
        setAppState("no-data");
        return;
      }

      const currentTime = new Date();
      const hourlyTimes = data.hourly.time || [];

      let startIndex = hourlyTimes.findIndex((t) => new Date(t) >= currentTime);
      if (startIndex === -1) startIndex = 0;

      const next24Hours = [];
      for (let i = startIndex; i < startIndex + 24; i++) {
        if (hourlyTimes[i]) {
          next24Hours.push({
            id: i.toString(),
            time: hourlyTimes[i],
            temp: data.hourly.temperature_2m?.[i],
            precipProb: data.hourly.precipitation_probability?.[i],
            precip: data.hourly.precipitation?.[i],
          });
        }
      }

      const finalData = {
        current: data.current,
        hourly: next24Hours,
        savedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(finalData));
      setWeatherData(finalData);
      setAppState("success");
    } catch (error) {
      try {
        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedData) {
          setWeatherData(JSON.parse(cachedData));
          setIsOffline(true);
          setAppState("success");
        } else {
          setErrorMessage(
            error.message ||
              "Nie udało się pobrać danych, a pamięć podręczna jest pusta."
          );
          setAppState("error");
        }
      } catch (storageError) {
        setErrorMessage("Błąd krytyczny podczas odczytu z pamięci urządzenia.");
        setAppState("error");
      }
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderHourlyItem = ({ item }) => (
    <View style={styles.hourlyItem}>
      <Text style={styles.hourlyTime}>{formatTime(item.time)}</Text>
      <Text style={styles.hourlyTemp}>{item.temp}°C</Text>
      <View style={styles.hourlyPrecip}>
        <Text style={styles.precipText}>{item.precipProb}%</Text>
        <Text style={styles.precipText}>{item.precip}mm</Text>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (appState) {
      case "loading":
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#007BFF" />
            <Text style={styles.text}>Pobieranie lokalizacji i pogody...</Text>
          </View>
        );

      case "permission-denied":
        return (
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>Brak uprawnień do lokalizacji.</Text>
            <Text style={styles.text}>
              Musisz zezwolić na dostęp do GPS, aby sprawdzić pogodę dla Twojej
              pozycji.
            </Text>
            <TouchableOpacity style={styles.button} onPress={fetchWeather}>
              <Text style={styles.buttonText}>Spróbuj ponownie</Text>
            </TouchableOpacity>
          </View>
        );

      case "error":
      case "no-data":
        return (
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>Wystąpił problem.</Text>
            <Text style={styles.text}>
              {appState === "no-data"
                ? "API nie zwróciło poprawnych danych."
                : errorMessage}
            </Text>
            <TouchableOpacity style={styles.button} onPress={fetchWeather}>
              <Text style={styles.buttonText}>Odśwież</Text>
            </TouchableOpacity>
          </View>
        );

      case "success":
        return (
          <View style={styles.fullContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Pogoda tu i teraz</Text>
              {isOffline && weatherData && (
                <Text style={styles.offlineWarning}>
                  Wczytano ostatnie dane offline (
                  {formatTime(weatherData.savedAt)})
                </Text>
              )}
            </View>

            {weatherData?.current && (
              <View style={styles.currentCard}>
                <Text style={styles.currentLabel}>Teraz</Text>
                <Text style={styles.currentTemp}>
                  {weatherData.current.temperature_2m}°C
                </Text>
                <Text style={styles.currentDetails}>
                  Wiatr: {weatherData.current.wind_speed_10m} km/h | Opad:{" "}
                  {weatherData.current.precipitation} mm
                </Text>
              </View>
            )}

            <Text style={styles.subtitle}>Najbliższe 24 godziny</Text>

            <FlatList
              data={weatherData?.hourly || []}
              keyExtractor={(item) => item.id}
              renderItem={renderHourlyItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={fetchWeather}
            >
              <Text style={styles.buttonText}>Odśwież pogodę</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderContent()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    paddingTop: 50,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  fullContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
  },
  offlineWarning: {
    color: "#d9534f",
    fontSize: 12,
    marginTop: 5,
    fontWeight: "bold",
  },
  currentCard: {
    backgroundColor: "#007BFF",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  currentLabel: {
    color: "#e0e0e0",
    fontSize: 16,
    textTransform: "uppercase",
  },
  currentTemp: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#fff",
    marginVertical: 10,
  },
  currentDetails: {
    color: "#fff",
    fontSize: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#444",
    marginBottom: 10,
  },
  hourlyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 8,
  },
  hourlyTime: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
    flex: 1,
  },
  hourlyTemp: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    flex: 1,
    textAlign: "center",
  },
  hourlyPrecip: {
    flex: 1,
    alignItems: "flex-end",
  },
  precipText: {
    fontSize: 12,
    color: "#666",
  },
  text: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
    color: "#444",
  },
  errorText: {
    fontSize: 20,
    color: "#d9534f",
    fontWeight: "bold",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#007BFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  refreshButton: {
    backgroundColor: "#007BFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
