import express, { type NextFunction, type Request, type Response } from "express";
import { DBConnect } from "./db/db.js";
import dotenv from "dotenv";
import { isValidEmail, isValidUsername } from "./utils/inputValidation.js";
import { User } from "./schema/user.models.js";
import bcrypt from "bcrypt";
import cors from "cors";
import { hashPassword } from "./utils/hashService.js";
import { generateToken, verifyToken } from "./utils/jwtService.js";
import { task as Task } from "./schema/task.models.js"

dotenv.config({
    path: "./.env",
});

DBConnect();

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// type alias for authenticated request
/* Request -> method, url, headers, body, query
 * auth? -> because request may or may not carry auth information
 */
type AuthenticatedRequest = Request & {
    auth?: {
        userId: string;
    };
};

type columnId = "todo" | "inprogress" | "done"

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.header("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }

        const token = authHeader.slice("Bearer ".length).trim();
        const decoded = verifyToken(token) as { userId?: string };

        if (!decoded?.userId) {
            return res.status(401).json({
                message: "Invalid token payload",
            });
        }

        req.auth = { userId: decoded.userId };
        next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token",
        });
    }
};

app.put("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const currentUserId = req.auth?.userId

        if(!currentUserId){
            return res.status(401).json({
                message: "Unauthorized"
            })
        }

        const rawUsername = typeof req.body?.username === "string" ? req.body.username.trim() : "";
        const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";

        const hasUsername = rawUsername.length > 0
        const hasEmail = rawEmail.length > 0

        if(!hasUsername && !hasEmail){
            return res.status(400).json({
                message: "At least one field is required: username or email"
            })
        }

        if(hasUsername && !isValidUsername(rawUsername)){
            return res.status(400).json({
                message: "Invalid username format"
            })
        }

        if(hasEmail && !isValidEmail(rawEmail)){
            return res.status(400).json({
                message: "Invalid email format"
            })
        }

        const nextUsername = hasUsername ? rawUsername.toLowerCase() : undefined;
        const nextEmail = hasEmail ? rawEmail.toLowerCase() : undefined;
        
        const duplicateChecks: Array<Record<string, string>> = [];

        if(nextUsername){
            duplicateChecks.push({
                username: nextUsername
            })
        };

        if(nextEmail){
            duplicateChecks.push({
                email: nextEmail
            })
        };

        if(duplicateChecks.length > 0){
            const conflictUser = await User.findOne({
                _id: { $ne: currentUserId },
                $or: duplicateChecks,
            })

            if(conflictUser){
                return res.status(409).json({
                    message: "Username or email is already in use"
                })
            }
        }

        const updatePayload: {
            username?: string;
            email?: string;
        } = {}

        if(nextUsername) updatePayload.username = nextUsername
        if(nextEmail) updatePayload.email = nextEmail

        const updatedUser = await User.findByIdAndUpdate(
            currentUserId,
            { $set: updatePayload },
            { new: true, runValidators: true }
        )

        if(!updatedUser){
            return res.status(404).json({
                message: "User not found"
            })
        }

        const { password: _, ...safeUser } = updatedUser.toObject() 

        const newToken = generateToken({
            userId: updatedUser._id.toString(),
            username: updatedUser.username,
            email: updatedUser.email
        });

        return res.status(200).json({
            statusCode: 200,
            message: "Profile updated successfully",
            user: safeUser,
            token: newToken
        });
    } catch (error: any) {
        if(error?.code === 11000){
            return res.status(409).json({
                message: "Username or email already exists"
            })
        }

        return res.status(500).json({
            message: "Something went wrong while updating profile"
        })
    }
});

/**
 * Register a new user
 * @route POST /register
 * @access Public
 */
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    // Validate input fields
    if (!isValidEmail(email) || !isValidUsername(username) || !password) {
        return res.status(400).json({
            message: "All fields are required",
        });
    }

    // check if user with same username or email already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        return res.status(409).json({
            message: "User with same username or email already exists",
        });
    }

    const hashedPassword = await hashPassword(password);

    // create new user in database
    const user = await User.create({
        username,
        email,
        password: hashedPassword,
    });

    if (!user) {
        res.status(409).json({
            message: "Something went wrong while creating user",
        });
        return;
    }

    // also send the user object to the client as a response
    // return res.status(201).json({
    //     statusCode: 201,
    //     message: "User Registered successfully",
    //     user: {
    //         _id: user._id,
    //         username: user.username,
    //         email: user.email,
    //     }
    // });

    // alternate
    const { password: _, ...safeUser } = user.toObject();
    return res.status(201).json({
        statusCode: 201,
        message: "User Registered Successfully",
        user: safeUser,
    });
});

/**
 * Login a new user
 * @route POST /login
 * @access Public
 */
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!isValidEmail(email) || !password) {
        return res.status(400).json({
            message: "All fields are required",
        });
    }

    // check if user with provided email exists in database
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(400).json({
            message: "User not found",
        });
    }

    const token = generateToken({
        userId: user._id,
        username: user.username,
        email: user.email,
    });

    /*
     * Compare the provided password with the stored hashed password
     * If the password is not valid, return 401 status code
     * If the password is valid, return 200 status code
     */
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({
            message: "Password is not valid",
        });
    }

    return res.status(200).json({
        statusCode: 200,
        message: "User logged in successfully",
        user: {
            _id: user._id,
            username: user.username,
            email: user.email,
        },
        token: token,
    });
});

const validColumns = new Set(["todo", "inprogress", "done"]);

const toClientTask = (doc: any) => ({
    id: doc._id.toString(),
    title: doc.title,
    tags: doc.tags ?? [],
    description: doc.description ?? "",
})

const buildBoardState = (docs: any[]) => {
    const state:
    {
        columns: Record<columnId, { id: columnId; title: string; taskIds: string[]}>; 
        tasks: Record<string, ReturnType<typeof toClientTask>>;
    } =  {
        columns: {
            "todo": { id: "todo", title: "To Do", taskIds: [] as string[] },
            "inprogress": { id: "inprogress", title: "In Progress", taskIds: [] as string[] },
            "done": { id: "done", title: "Done", taskIds: [] as string[] },
        },
        tasks: {},
    };

    for(const doc of docs){
        const id = doc._id.toString();
        const columnId = doc.columnId as columnId

        state.tasks[id] = toClientTask(doc);
        state.columns[columnId].taskIds.push(id);
    }

    return state;
}

app.get("/board", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.userId

    if(!userId){
        return res.status(401).json({
            message: "Unauthorized"
        })
    }

    const docs = await Task.find({ userId }).sort({
        columnId: 1,
        order: 1,
        createdAt: 1
    })

    return res.status(200).json({
        statusCode: 200,
        board: buildBoardState(docs),
    })
})

app.post("/tasks", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.userId

    if(!userId){
        return res.status(401).json({
            message: "Unauthorized"
        })
    }

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    
    // the default task should go to the "todo"
    const columnId = typeof req.body?.columnId === "string" ? req.body.columnId : "todo"
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((task:string) => String(task).trim()).filter(Boolean) : []
    const description = typeof req.body?.description === "string" ? req.body?.description.trim() : ""

    if(!title){
        return res.status(400).json({
            message: "Title is required"
        })
    }

    if(!validColumns.has(columnId)){
        return res.status(400).json({
            message: "Invalid columnId"
        })
    }

    const last = await Task.findOne({ userId, columnId }).sort({ order: -1}).select("order");
    const order = typeof last?.order === "number" ? last.order + 1 : 0

    const created = await Task.create({
        userId,
        columnId,
        title,
        tags, 
        description, 
        order
    })

    return res.status(201).json({
        statusCode: 201,
        message: "Task created",
        task: toClientTask(created),
        columnId,
    });
});

app.patch("/tasks/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.userId
    if(!userId){
        return res.status(401).json({
            message: "Unauthorized"
        })
    }

    const updates: Record<string, any> = {};

    if(typeof req.body?.title === "string"){
        updates.title = req.body.title.trim();
    }

    if(typeof req.body?.description === "string"){
        updates.description = req.body.description.trim();
    }

    if(Array.isArray(req.body?.tags)){
        updates.tags = req.body.tags.map((task: string) => String(task).trim()).filter(Boolean);
    }

    const updated = await Task.findOneAndUpdate(
        { _id: req.params.id, userId },
        { $set: updates },
        { new: true, runValidators: true }
    ) 

    if(!updated){
        return res.status(404).json({
            message: "Task not found"
        })
    }

    return res.status(200).json({
        statusCode: 200,
        message: "Task created",
        task: toClientTask(updated),
        columnId: updated.columnId
    })
})

app.patch("/tasks/:id/move", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.userId
    if(!userId){
        return res.status(401).json({
            message: "unauthorized"
        })
    }

    const targetColumnId = typeof req.body?.targetColumnId === "string" ? req.body?.targetColumnId : ""
    if(!validColumns.has(targetColumnId)){
        return res.status(400).json({
            message: "Invalid targetColumnId"
        })
    }

    const last = await Task.findOne({
        userId,
        columnId: targetColumnId  
    }).sort({ order: -1 }).select("order")

    const nextOrder = typeof last?.order === "number" ? last.order + 1 : 0

    const moved = await Task.findOneAndUpdate(
        { _id: req.params.id, userId },
        { $set: { columnId: targetColumnId, order: nextOrder } },
        { new: true }
    )

    if(!moved){
        return res.status(404).json({
            message: "Task not found"
        })
    }

    return res.status(200).json({
        statusCode: 200,
        message: "Task moved",
        task: toClientTask(moved),
        columnId: moved.columnId
    });
});

app.delete("/tasks/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.userId
    if(!userId){
        return res.status(401).json({
            message: "Unauthorized"
        })
    }

    const deleted = await Task.findOneAndDelete({
        _id: req.params.id, userId
    });

    if(!deleted){
        return res.status(404).json({
            message: "Task not found"
        })
    }

    return res.status(200).json({
        statusCode: 200,
        message: "Task deleted",
        taskId: req.params.id,
        columnId: deleted.columnId
    });
})

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

app.get("/", (req, res) => {
    res.send("Hello, World!");
});
