import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export default function useLocalStorageState<S>(key: string, initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const [value, setValue] = useState<S>(() => {
    const storedValue = localStorage.getItem(key);
    return (storedValue ? JSON.parse(storedValue) : initialState);
  });

  function setLocalStorageValue(value: SetStateAction<S>) {
    if (value !== undefined) {
      setValue(value)
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  return [value, setLocalStorageValue];
}