import { useState, useRef, useCallback, useEffect } from "react";

import useLatest from "./useLatest";
import _debounce from "./debounce";
import useUncontrolled from "./use-uncontrolled";

export interface HookArgs {
  requestOptions?: Omit<google.maps.places.AutocompletionRequest, "input">;
  debounce?: number;
  cache?: number | false;
  cacheKey?: string;
  googleMaps?: any;
  callbackName?: string;
  initOnMount?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
}

type Suggestion = google.maps.places.AutocompletePrediction;

type Status = `${google.maps.places.PlacesServiceStatus}` | "";

interface Suggestions {
  readonly loading: boolean;
  readonly status: Status;
  data: Suggestion[];
}

interface SetValue {
  (val: string, shouldFetchData?: boolean): void;
}

interface HookReturn {
  ready: boolean;
  value: string;
  suggestions: Suggestions;
  setValue: SetValue;
  clearSuggestions: () => void;
  clearCache: (key?: string) => void;
  init: () => void;
}

export const loadApiErr =
  "💡 use-places-autocomplete: Google Maps Places API library must be loaded. See: https://github.com/wellyshen/use-places-autocomplete#load-the-library";

const usePlacesAutocomplete = ({
  requestOptions,
  debounce = 200,
  cache = 24 * 60 * 60,
  cacheKey = "upa",
  googleMaps,
  callbackName,
  value,
  defaultValue = "",
  onChange,
  initOnMount = true,
}: HookArgs = {}): HookReturn => {
  const [ready, setReady] = useState(false);
  const [_value, handleChange] = useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange,
  });

  const [suggestions, setSuggestions] = useState<Suggestions>({
    loading: false,
    status: "",
    data: [],
  });
  const asRef = useRef<google.maps.places.AutocompleteService>();
  const requestOptionsRef = useLatest(requestOptions);
  const googleMapsRef = useLatest(googleMaps);

  const init = useCallback(() => {
    if (asRef.current) return;

    const { google } = window;
    const { current: gMaps } = googleMapsRef;
    const placesLib = gMaps?.places || google?.maps?.places;

    if (!placesLib) {
      console.error(loadApiErr);
      return;
    }

    asRef.current = new placesLib.AutocompleteService();
    setReady(true);
  }, [googleMapsRef]);

  const clearSuggestions = useCallback(() => {
    setSuggestions({ loading: false, status: "", data: [] });
  }, []);

  const clearCache = useCallback(
    (key = cacheKey) => {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        // Skip exception
      }
    },
    [cacheKey]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchPredictions = useCallback(
    _debounce((val: string) => {
      if (!val) {
        clearSuggestions();
        return;
      }

      setSuggestions((prevState) => ({ ...prevState, loading: true }));

      let cachedData: Record<string, { data: Suggestion[]; maxAge: number }> =
        {};

      try {
        cachedData = JSON.parse(sessionStorage.getItem(cacheKey) || "{}");
      } catch (error) {
        // Skip exception
      }

      if (cache) {
        cachedData = Object.keys(cachedData).reduce(
          (acc: typeof cachedData, key) => {
            if (cachedData[key].maxAge - Date.now() >= 0)
              acc[key] = cachedData[key];
            return acc;
          },
          {}
        );

        if (cachedData[val]) {
          setSuggestions({
            loading: false,
            status: "OK",
            data: cachedData[val].data,
          });
          return;
        }
      }

      asRef.current?.getPlacePredictions(
        { ...requestOptionsRef.current, input: val },
        (data: Suggestion[] | null, status: Status) => {
          setSuggestions({ loading: false, status, data: data || [] });

          if (cache && status === "OK") {
            cachedData[val] = {
              data: data as Suggestion[],
              maxAge: Date.now() + cache * 1000,
            };

            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(cachedData));
            } catch (error) {
              // Skip exception
            }
          }
        }
      );
    }, debounce),
    [cache, cacheKey, clearSuggestions, requestOptionsRef]
  );

  const setValue: SetValue = useCallback(
    (val, shouldFetchData = true) => {
      handleChange(val);
      if (asRef.current && shouldFetchData) fetchPredictions(val);
    },
    [fetchPredictions, handleChange]
  );

  useEffect(() => {
    if (!initOnMount) return () => null;

    const { google } = window;

    if (!googleMapsRef.current && !google?.maps && callbackName) {
      (window as any)[callbackName] = init;
    } else {
      init();
    }

    return () => {
      // @ts-ignore
      if ((window as any)[callbackName]) delete (window as any)[callbackName];
    };
  }, [callbackName, googleMapsRef, init, initOnMount]);

  return {
    ready,
    value: _value,
    suggestions,
    setValue,
    clearSuggestions,
    clearCache,
    init,
  };
};

export default usePlacesAutocomplete;
