const {Context} = require ("@pushcorn/hocon-parser/lib/core/Context");

async function parseFileStrict(hoconUrl: String): Promise<Object> {
    var context = new Context ({url: hoconUrl, strict: true});
    var result  = await context.resolve();
    return result;
}

export {parseFileStrict};