import { registerSchema, loginSchema } from "./auth.validation.js";
import { registerUser, loginUser } from "./auth.service.js";

export async function register (req,res,next){
    const result= registerSchema.safeParse(req.body);

    if(!result.success) {
        return res.status(400).json({
            error: "Invalid registration data",
            details: result.error.flatten().fieldErrors,
        });
    }
    try {
        const user= await registerUser(result.data);
        if(!user)return res.status(409).json({error: "Email already exists"})
        return res.status(201).json({user});
    } catch (error) {
        const postgresCode = error?.cause?.code ?? error?.code;

    if (postgresCode === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }

    return next(error);
    }
}

export async function login(req, res, next) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Invalid login data",
      details: result.error.flatten().fieldErrors,
    });
  }

  try {
    const loginResult = await loginUser(result.data);

    if (!loginResult) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    return res.status(200).json(loginResult);
  } catch (error) {
    return next(error);
  }
}