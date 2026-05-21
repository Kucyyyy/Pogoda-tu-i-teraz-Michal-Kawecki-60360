Dokumentacja projektu: Pogoda „tu i teraz”
1. Opis celu aplikacji
Celem aplikacji "Pogoda tu i teraz" jest dostarczenie użytkownikowi informacji o aktualnych warunkach meteorologicznych oraz godzinowej prognozy pogody na najbliższe 24 godziny, opartych na jego bieżącym położeniu geograficznym. Wdrożono w niej obsługę rozszerzeń: możliwość ręcznego odświeżania danych oraz mechanizm zapamiętywania ostatniego wyniku (lokalny cache), który pozwala na dostęp do ostatnich znanych danych w przypadku utraty połączenia z internetem.

2. Opis wykorzystanych danych z urządzenia
Aplikacja pobiera z urządzenia fizycznego dane pochodzące z sensora lokalizacji (GPS/dane z sieci komórkowej). Po uzyskaniu uprawnień, z obiektu lokalizacyjnego wyodrębniane są dokładnie dwie kluczowe wartości:
Szerokość geograficzna (latitude)
Długość geograficzna (longitude)

3. Opis wykorzystanych bibliotek i API
Do stworzenia aplikacji wykorzystano następujące technologie:

React Native / Expo
expo-location: Moduł z ekosystemu Expo, wykorzystany do bezpiecznego zarządzania uprawnieniami systemowymi (requestForegroundPermissionsAsync) oraz bezpośredniego pobierania bieżących współrzędnych urządzenia (getCurrentPositionAsync).
@react-native-async-storage/async-storage: Asynchroniczna biblioteka do przechowywania danych w pamięci lokalnej telefonu (klucz-wartość). Wykorzystana do zapisywania i odczytywania ostatniego poprawnego wyniku zapytania (realizacja rozszerzenia).
Open-Meteo API: Zewnętrzne, darmowe API dostarczające dane meteorologiczne. Wykorzystano publiczny endpoint, do którego wysyłane jest żądanie z odpowiednimi parametrami, aby odzyskać dane bieżące (current) oraz godzinowe (hourly).

4. Opis przepływu danych w aplikacji
Po uruchomieniu aplikacji lub naciśnięciu przycisku odświeżania wywoływana jest funkcja fetchWeather. Aplikacja przechodzi w stan loading (wyświetlany jest wskaźnik ładowania).
Uprawnienia i GPS: System odpytuje użytkownika o zgodę na użycie lokalizacji. W przypadku braku zgody, interfejs renderuje ekran odmowy. W przypadku akceptacji, pobierane są koordynaty z GPS.
Komunikacja z API: Pobrane współrzędne są doklejane do adresu URL i wysyłane jako żądanie HTTP GET do API Open-Meteo.
Transformacja danych: Zwrócony obiekt JSON jest przetwarzany. Ponieważ API zwraca długie tablice dniowe, algorytm szuka indeksu odpowiadającego obecnej dacie i godzinie, a następnie wycina z tablic dokładnie 24 kolejne godziny prognozy.
Zapis i renderowanie (Sukces): Wyselekcjonowane dane są formatowane do jednego obiektu i zapisywane w AsyncStorage (wraz z sygnaturą czasową). Następnie trafiają do stanu komponentu, wyzwalając wyrenderowanie zaktualizowanego interfejsu.
Mechanizm Offline (Fallback): Jeśli na którymkolwiek etapie komunikacji z siecią wystąpi błąd (np. brak internetu), blok catch odpytuje AsyncStorage o historię. Jeśli odnajdzie wcześniej zapisany plik, wyświetla interfejs pogodowy z ostrzeżeniem w kolorze czerwonym: "Wczytano ostatnie dane offline".

5. Lista ograniczeń i problemów napotkanych podczas realizacji
Struktura danych API Open-Meteo: API nie zwraca łatwej do zmapowania tablicy obiektów {godzina, temperatura}, lecz osobne, równoległe tablice dla czasu, temperatury i opadów, z góry narzucone dla całych dni. Wyzwaniem było napisanie logiki, która odnajdzie odpowiedni indeks (w oparciu o czas systemowy urządzenia) i skompletuje pojedyncze obiekty w jedną tablicę używaną do renderowania widoku.
Problem dostępności : Urządzenie może poprawnie i szybko pobrać sygnał GPS, ale nie mieć dostępu do sieci komórkowej, by pobrać zapytanie HTTP. Wymusiło to zaimplementowanie bezawaryjnej obsługi błędów za pomocą AsyncStorage, tak aby brak sieci nie zawiesił aplikacji na białym ekranie lub krytycznym błędzie.Renderowanie 24 rzędów z danymi w pętli przy pomocy zwykłego widoku na słabszych urządzeniach mogłoby powodować spadek klatek (frame drops). W ramach optymalizacji wykorzystano komponent FlatList, który zarządza pamięcią asynchronicznie, ładując tylko widoczne na ekranie elementy.

Dokładność lokalizacji we wnętrzach: Standardowa asynchroniczna prośba o lokalizację używająca wysokiej precyzji w budynkach bardzo często przedłuża czas ładowania (szukanie FIX'a GPS). Rozwiązaniem było użycie parametru Location.Accuracy.Balanced, co znacznie przyspiesza pozyskiwanie koordynatów z masztów BTS w zamian za akceptowalną utratę metrowej dokładności (która nie jest wymagana w przypadku pogody).
