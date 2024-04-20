import { model, Schema } from "mongoose";

const UserModel = new model('User', new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, required: true, default: false }
}));

export default UserModel;