import { model, Schema, Types } from "mongoose";

const ReviewModel = new model('Review', new Schema({
    user: { type: Types.ObjectId, required: true, ref: 'User' },
    service: { type: String, required: true },
    comment: { type: String, required: true },
    label: { type: String, required: true },
    score: { type: Number, required: true }
}, {
    timestamps: true
}));

export default ReviewModel;