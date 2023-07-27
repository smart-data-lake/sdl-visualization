
/**
 * Function to transform a value by a function if it is defined, and otherwise returns a default value.
 */
export function transformOrDefault<In,Out>(input: In, f: (In) => Out, defaultVal: Out) {
    return (input ? f(input) : defaultVal);
}

export function withDefault<Type>(input: Type, defaultVal: Type) {
    return (input ? input : defaultVal);
}