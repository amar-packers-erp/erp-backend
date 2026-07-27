import mongoose, { Schema } from "mongoose";

const OrderSchema = new Schema(
{
  // ==========================
  // Order Information
  // ==========================
  orderInfo: {
    customerRef: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    itemRef: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      default: null,
    },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    customerName: {
      type: String,
      required: true,
    },

    itemBrand: {
      type: String,
      default: "",
    },

    itemName: {
      type: String,
      required: true,
    },

    quantityOrdered: {
      type: Number,
      required: true,
    },
  },

  // ==========================
  // Box Specification
  // ==========================
  boxSpecification: {

    boxType: {
      type: String,
      default: "",
    },

    boxesPerSheet: {
      type: Number,
      default: 0,
    },

    itemSerialNumber: {
      type: String,
      default: "",
    },

    dieSerialNumber: {
      type: String,
      default: "",
    },

    length: {
      type: Number,
      default: 0,
    },

    breadth: {
      type: Number,
      default: 0,
    },

    height: {
      type: Number,
      default: 0,
    },

    sheetLength: {
      type: Number,
      default: 0,
    },

    sheetBreadth: {
      type: Number,
      default: 0,
    },
  },

  // ==========================
  // Duplex Cost
  // ==========================
  duplexCost: {

    length: {
      type: Number,
      default: 0,
    },

    breadth: {
      type: Number,
      default: 0,
    },

    gsm: {
      type: Number,
      default: 0,
    },

    rate: {
      type: Number,
      default: 0,
    },

    area: {
      type: Number,
      default: 0,
    },

    sheetWeight: {
      type: Number,
      default: 0,
    },

    qtyRequiredSheets: {
      type: Number,
      default: 0,
    },

    cost: {
      type: Number,
      default: 0,
    },
  },

  // ==========================
  // 2-Ply Cost
  // ==========================
  twoPlyCost: {

    numberOfPly: {
      type: String,
      default: "",
    },

    gsmEachPly: {
      type: Number,
      default: 0,
    },

    ratePerRoll: {
      type: Number,
      default: 0,
    },

    totalCost: {
      type: Number,
      default: 0,
    },
  },

  // ==========================
  // Finishing
  // ==========================
  finishing: {

    printed: {
      type: Boolean,
      default: false,
    },

    laminated: {
      type: Boolean,
      default: false,
    },

    PrintingSize: {
      type: Number,
      default: 0,
    },

    PrintingSheets: {
      type: Number,
      default: 0,
    },

    PrintingCost: {
      type: Number,
      default: 0,
    },

    lamRollSize: {
      type: Number,
      default: 0,
    },

    lamSheetLength: {
      type: Number,
      default: 0,
    },

    lamType: {
      type: String,
      default: "BOPP",
    },

    fevicolCostPerSheet: {
      type: Number,
      default: 0,
    },

    lamCostPerSheet: {
      type: Number,
      default: 0,
    },

    laminationCost: {
      type: Number,
      default: 0,
    },
  },

  // ==========================
  // Processing Cost
  // ==========================
  processing: {

    sheeterRate: {
      type: Number,
      default: 0,
    },

    pastingRate: {
      type: Number,
      default: 0,
    },

    dieRate: {
      type: Number,
      default: 0,
    },

    stitchRate: {
      type: Number,
      default: 0,
    },

    strapRate: {
      type: Number,
      default: 0,
    },

    totalProcessingCost: {
      type: Number,
      default: 0,
    },
  },

  // ==========================
  // Cost Summary
  // ==========================
  summary: {

    duplexCost: {
      type: Number,
      default: 0,
    },

    twoPlyCost: {
      type: Number,
      default: 0,
    },

    PrintingCost: {
      type: Number,
      default: 0,
    },

    laminationCost: {
      type: Number,
      default: 0,
    },

    processingCost: {
      type: Number,
      default: 0,
    },

    perBoxCost: {
      type: Number,
      default: 0,
    },

    totalOrderCost: {
      type: Number,
      default: 0,
    },
  },

  // ==========================
  // Delivery Tracking
  // ==========================
  quantityDelivered: {
    type: Number,
    default: 0,
  },

  // ==========================
  // Workflow
  // ==========================
  productionStage: {
    type: String,
    enum: [
      "Not Started",
      "Sent to Job Work",
      "Printed",
      "Printed & Laminated",
    ],
    default: "Not Started",
  },

  jobWorkRef: {
    type: Schema.Types.ObjectId,
    ref: "JobWork",
    default: null,
  },

  dispatchRef: {
    type: Schema.Types.ObjectId,
    ref: "Dispatch",
    default: null,
  },

  status: {
    type: String,
    enum: [
      "Pending",
      "Approved",
      "In Production",
      "Completed",
      "Dispatched",
      "Cancelled",
    ],
    default: "Pending",
  },

},
{
  timestamps: true,
}
);

export default mongoose.model("Order", OrderSchema);
