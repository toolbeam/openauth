export async function load(event) {
    return {
        subject: event.locals.session
    }
}