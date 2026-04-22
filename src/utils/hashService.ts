import bcrypt from "bcrypt";

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
}

export const comparePassword = async (defaultPassword: string, hashedPassword: string) => {
    return await bcrypt.compare(defaultPassword, hashedPassword);
}