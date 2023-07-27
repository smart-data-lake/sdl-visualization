import { DependencyList, useMemo } from "react";
import { withDefault } from "../util/helpers";

export function useMemoWithDefault<Type>(f: () => Type, deps: DependencyList | undefined, defaultValue: Type): Type {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return withDefault(useMemo(f, deps), defaultValue);
}