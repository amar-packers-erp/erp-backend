import mongoose, { Schema } from "mongoose";

const ItemSchema = new Schema({
  itemCode: { type: String, required: true, unique: true, trim: true },
  itemName: { type: String, required: true, trim: true },
  brand: { type: String, trim: true },
  customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
  type: {
    type: String,
    required: true,
    enum: ["Duplex", "Reel", "PrintedPaper", "FinishedGood", "Consumable", "RawMaterial"]
  },
  category: { type: String, required: true, trim: true },
  specifications: {
    gsm: { type: Number },
    dimensions: { type: String },
    ply: { type: String },
    flute: { type: String }
  },
  boxSpecification: {
    boxType: { type: String, default: "" },
    boxesPerSheet: { type: Number, default: 1 },
    itemSerialNumber: { type: String, default: "" },
    dieSerialNumber: { type: String, default: "" },
    length: { type: Number, default: 0 },
    breadth: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    sheetLength: { type: Number, default: 0 },
    sheetBreadth: { type: Number, default: 0 },
  },
  orderConfigurations: {
    duplexLength: { type: Number, default: 0 },
    duplexBreadth: { type: Number, default: 0 },
    duplexGsm: { type: Number, default: 0 },
    duplexRate: { type: Number, default: 0 },
    numberOf2Ply: { type: String, default: "0" },
    twoPlyGsm: { type: Number, default: 0 },
    twoPlyRate: { type: Number, default: 0 },
    printed: { type: Boolean, default: false },
    laminated: { type: Boolean, default: false },
    PrintingSize: { type: Number, default: 0 },
    PrintingCost: { type: Number, default: 0 },
    PrintingSheets: { type: Number, default: 0 },
    lamRollSize: { type: Number, default: 0 },
    lamSheetLength: { type: Number, default: 0 },
    lamType: { type: String, default: "BOPP" },
    fevicolCostPerSheet: { type: Number, default: 0 },
    lamCostPerSheet: { type: Number, default: 0 },
    sheeterRate: { type: Number, default: 0 },
    pastingRate: { type: Number, default: 0 },
    dieRate: { type: Number, default: 0 },
    stitchingRate: { type: Number, default: 0 },
    strappingRate: { type: Number, default: 0 },
  },
  unitOfMeasure: { type: String, required: true, trim: true },
  linkedReels: {
    kraft: {
      inventoryId: { type: Schema.Types.ObjectId, ref: "Inventory" },
      ratio: { type: Number },
    },
    semiKraft: {
      inventoryId: { type: Schema.Types.ObjectId, ref: "Inventory" },
      ratio: { type: Number },
    },
  },
});

ItemSchema.index(
  {
    brand: 1,
    itemName: 1,
    type: 1,
    category: 1,
    "specifications.gsm": 1,
    "specifications.dimensions": 1,
  },
  { unique: true }
);

export default mongoose.model("Item", ItemSchema);
