function isValidEmail(email: string): boolean{
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function isValidUsername(username: string): boolean{
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(username);
}

export { isValidEmail, isValidUsername };