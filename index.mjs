import { loadLayersModel, io, tensor2d, pad } from '@tensorflow/tfjs-node';
import { AutoTokenizer } from '@xenova/transformers';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connect, set } from 'mongoose';
import { ObjectId } from 'mongodb';
import express from 'express';
import cors from 'cors';
import bcrypt from "bcrypt";
import User from './models/User.mjs';
import Review from './models/Review.mjs';

const labels = ['negative', 'nutral', 'positive'];

loadLayersModel(io.fileSystem('./models/model_v2/model.json')).then(model => {
    AutoTokenizer.from_pretrained('Xenova/bert-base-uncased').then(tokenizer => {
        const predictSentiment = (text) => {
            const seq = tokenizer(text, { max_length: 200, padding: 'max_length', truncation: true, return_tensor: false });
            const tensors = tensor2d(seq['input_ids'], [1, 200]);
            const scores = model.predict(tensors).dataSync();
            const max_score_i = scores.indexOf(Math.max(...scores));
            return { score: scores[max_score_i], label: labels[max_score_i] };
        }

        const app = express();
        app.use(cors());
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Fetch all the reviews
        app.post("/all-reviews", (req, res) => {
            Review.find().sort({ 'createdAt': -1 }).populate('user').then((value) => {
                res.status(200).json(value);
            }).catch((err) => res.status(500).json({ message: err.message }))
        })

        // Fetch all the reviews of an user
        app.post("/user-reviews/:userId", (req, res) => {
            Review.find({ user: req.params.userId }).sort({ 'createdAt': -1 }).populate('user').then((value) => {
                res.status(200).json(value);
            }).catch((err) => res.status(500).json({ message: err.message }))
        })

        // Save Review
        app.post("/save-review", (req, res) => {
            Review.create({
                user: new ObjectId(req.body.userId),
                service: req.body.service,
                comment: req.body.comment,
                ...predictSentiment(req.body.comment)
            }).then((value) => {
                value.populate('user').then(val => {
                    res.status(200).json(val);
                }).catch((err) => res.status(500).json({ message: err.message }))
            }).catch((err) => res.status(500).json({ message: err.message }))
        })

        // Admin Signup
        app.post("/admin-signup", (req, res) => {
            User.create({
                name: req.body.name,
                email: req.body.email.toLowerCase(),
                password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10)),
                isAdmin: true
            }).then(user => {
                res.status(200).json(user);
            }).catch(err => res.status(500).json({ message: err.message }));
        })

        // User Signup
        app.post("/user-signup", (req, res) => {
            User.create({
                name: req.body.name,
                email: req.body.email.toLowerCase(),
                password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10)),
                isAdmin: false
            }).then(user => {
                res.status(200).json(user);
            }).catch(err => res.status(500).json({ message: err.message }));
        })

        // Admin Login
        app.post("/admin-login", (req, res) => {
            User.findOne({ email: req.body.email, isAdmin: true }).then(user => {
                if (user) {
                    bcrypt.compare(req.body.password, user.password).then(result => {
                        if (result) {
                            res.status(200).json(user);
                        } else res.status(400).json({ message: "Wrong password!" });
                    }).catch(err => res.status(500).json({ message: err.message }));
                } else res.status(400).json({ message: "User not found! Please register." });
            }).catch(err => res.status(500).json({ message: err.message }));
        })

        // User Login
        app.post("/user-login", (req, res) => {
            User.findOne({ email: req.body.email, isAdmin: false }).then(user => {
                if (user) {
                    bcrypt.compare(req.body.password, user.password).then(result => {
                        if (result) {
                            res.status(200).json(user);
                        } else res.status(400).json({ message: "Wrong password!" });
                    }).catch(err => res.status(500).json({ message: err.message }));
                } else res.status(400).json({ message: "User not found! Please register." });
            }).catch(err => res.status(500).json({ message: err.message }));
        })

        const server = createServer(app);
        // Initializing Socket
        new Server(server).on('connection', (ws) => {
            ws.on('predict', (data) => {
                ws.emit("prediction", predictSentiment(data || ""))
            })
        })

        // Connecting the database
        set('strictQuery', true);
        connect('mongodb://127.0.0.1:27017/', { dbName: 'FY_Project' }).then(res => {
            console.log("Database Connected");
            // Starting Server
            server.listen(8000, () => {
                console.log("server running!");
            })
        }).catch(err => {
            console.log(err);
        })
    }).catch(err => {
        console.log(err);
    })
}).catch(err => {
    console.log(err);
})