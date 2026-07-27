import Order from "../../models/order.model";
import Inventory from "../../models/Inventory.model";
import Item from "../../models/item.model";
import StockTransaction from "../../models/StockTransaction";
import JobWork from "../../models/jobWork.model";
import Dispatch from "../../models/dispatch.model";

function parseLeadingNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const match = value.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function computeCorrugatedDeduction(
  reelSize: number,
  length: number,
  gsm: number,
  noOf2Ply: number,
  totalSheets: number
) {
  return (((reelSize * length) / 1500) * gsm / 1000) * noOf2Ply * totalSheets;
}

// Helper: flatten nested order doc into a flat object for the frontend
function flattenOrder(o: any) {
  const qtyOrdered = o.orderInfo?.quantityOrdered || o.quantityOrdered || 0;
  const qtyDelivered = o.quantityDelivered || 0;
  return {
    _id: o._id,
    customerId: o.orderInfo?.customerRef || null,
    itemId: o.orderInfo?.itemRef || null,
    orderNumber: o.orderInfo?.orderNumber || o.orderNumber || "—",
    customerName: o.orderInfo?.customerName || o.customerName || "—",
    itemBrand: o.orderInfo?.itemBrand || o.itemBrand || "",
    itemName: o.orderInfo?.itemName || o.itemName || "—",
    quantityOrdered: qtyOrdered,
    quantityDelivered: qtyDelivered,
    quantityRemaining: Math.max(0, qtyOrdered - qtyDelivered),
    itemSerialNumber: o.boxSpecification?.itemSerialNumber || o.itemSerialNumber || "",
    dieSerialNumber: o.boxSpecification?.dieSerialNumber || o.dieSerialNumber || "",
    boxType: o.boxSpecification?.boxType || o.boxType || "",
    length: o.boxSpecification?.length || o.length || 0,
    breadth: o.boxSpecification?.breadth || o.breadth || 0,
    height: o.boxSpecification?.height || o.height || 0,
    sheetLength: o.boxSpecification?.sheetLength || o.sheetLength || 0,
    sheetBreadth: o.boxSpecification?.sheetBreadth || o.sheetBreadth || 0,
    boxesPerSheet: o.boxSpecification?.boxesPerSheet || 1,
    printed: o.finishing?.printed || o.printed || false,
    laminated: o.finishing?.laminated || o.laminated || false,
    duplexLength: o.duplexCost?.length || 0,
    duplexBreadth: o.duplexCost?.breadth || 0,
    duplexGsm: o.duplexCost?.gsm || 0,
    duplexRate: o.duplexCost?.rate || 0,
    numberOf2Ply: o.twoPlyCost?.numberOfPly || "0",
    twoPlyGsm: o.twoPlyCost?.gsmEachPly || 0,
    twoPlyRate: o.twoPlyCost?.ratePerRoll || 0,
    PrintingSize: o.finishing?.PrintingSize || 0,
    PrintingSheets: o.finishing?.PrintingSheets || 0,
    PrintingCost: o.finishing?.PrintingCost || 0,
    lamRollSize: o.finishing?.lamRollSize || 0,
    lamSheetLength: o.finishing?.lamSheetLength || 0,
    lamType: o.finishing?.lamType || "BOPP",
    fevicolCostPerSheet: o.finishing?.fevicolCostPerSheet || 0,
    lamCostPerSheet: o.finishing?.lamCostPerSheet || 0,
    sheeterRate: o.processing?.sheeterRate || 0,
    pastingRate: o.processing?.pastingRate || 0,
    dieRate: o.processing?.dieRate || 0,
    stitchingRate: o.processing?.stitchRate || 0,
    strappingRate: o.processing?.strapRate || 0,
    totalCost: o.summary?.totalOrderCost || 0,
    perBoxCost: o.summary?.perBoxCost || 0,
    productionStage: o.productionStage || "Not Started",
    jobWorkRef: o.jobWorkRef || null,
    dispatchRef: o.dispatchRef || null,
    status: o.status || "Pending",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * When a NON-PRINTED order is completed, deduct raw materials from inventory.
 *
 * Printed orders are deliberately skipped here: their stock moves at two other
 * points instead — the source material is deducted when the order is sent to
 * job work, and the finished printed item is deducted when the order is
 * dispatched. Deducting raw materials on completion too would double-count.
 *
 * Consumption logic (non-printed orders only):
 * - Sheets consumed = quantityOrdered / boxesPerSheet
 * - Deducts from the first available Duplex inventory item
 * - If laminated, deducts lamination film sheets
 * - Deducts stitching wire (1 per box) and strapping (1 per 50 boxes)
 *
 * Creates StockTransaction OUT records for audit trail.
 */
async function deductInventoryOnCompletion(order: any) {
  if (order?.finishing?.printed) {
    return [];
  }

  const qty = order.orderInfo?.quantityOrdered || 0;
  const boxesPerSheet = order.boxSpecification?.boxesPerSheet || 1;
  const sheetsConsumed = Math.ceil(qty / boxesPerSheet);
  const orderNumber = order.orderInfo?.orderNumber || "Unknown";
  const isLaminated = order.finishing?.laminated || false;

  // Define what materials to deduct and how much
  const deductions: { category: string; quantity: number; note: string }[] = [];

  // 1. Duplex Board — sheets consumed
  if (sheetsConsumed > 0) {
    deductions.push({
      category: "Duplex Bundle",
      quantity: sheetsConsumed,
      note: `${sheetsConsumed} sheets for ${qty} boxes (${boxesPerSheet} boxes/sheet)`,
    });
  }

  // 2. Kraft Paper / Corrugated Rolls — same sheets count for 2-ply layers
  const numPly = Number(order.twoPlyCost?.numberOfPly) || 0;
  if (numPly > 0 && sheetsConsumed > 0) {
    deductions.push({
      category: "Corrugated Rolls",
      quantity: sheetsConsumed * numPly,
      note: `${sheetsConsumed * numPly} sheets (${numPly} ply × ${sheetsConsumed} sheets)`,
    });
  }

  // 3. Lamination Film — if laminated, consume same number of sheets
  if (isLaminated && sheetsConsumed > 0) {
    deductions.push({
      category: "Lamination Film",
      quantity: sheetsConsumed,
      note: `${sheetsConsumed} sheets of lamination film`,
    });
  }

  // 4. Stitching Wire — 1 unit per box
  if (qty > 0) {
    deductions.push({
      category: "Stitching Wire",
      quantity: Math.ceil(qty / 100), // 1 unit per 100 boxes
      note: `Wire for ${qty} boxes`,
    });
  }

  // 5. Strapping Bundles — 1 per 50 boxes
  if (qty > 0) {
    deductions.push({
      category: "Strapping Bundles",
      quantity: Math.ceil(qty / 50),
      note: `Strapping for ${qty} boxes`,
    });
  }

  const results: string[] = [];

  for (const deduction of deductions) {
    try {
      // Find items in this category
      const items = await Item.find({ category: deduction.category }).select("_id");
      if (items.length === 0) continue;

      // Find the first inventory record with enough stock
      const inventory = await Inventory.findOne({
        itemRef: { $in: items.map((i) => i._id) },
        currentStock: { $gte: deduction.quantity },
      });

      if (!inventory) {
        // If no single item has enough, use the first one and let it go negative
        const fallback = await Inventory.findOne({
          itemRef: { $in: items.map((i) => i._id) },
        });
        if (!fallback) continue;

        await StockTransaction.create({
          inventoryRef: fallback._id,
          type: "OUT",
          quantity: deduction.quantity,
          referenceNumber: orderNumber,
          notes: `Order ${orderNumber} completed — ${deduction.note}`,
        });

        await Inventory.findByIdAndUpdate(fallback._id, {
          $inc: { currentStock: -deduction.quantity },
        });

        results.push(`${deduction.category}: -${deduction.quantity} (low stock warning)`);
        continue;
      }

      // Create OUT transaction
      await StockTransaction.create({
        inventoryRef: inventory._id,
        type: "OUT",
        quantity: deduction.quantity,
        referenceNumber: orderNumber,
        notes: `Order ${orderNumber} completed — ${deduction.note}`,
      });

      // Deduct from inventory
      await Inventory.findByIdAndUpdate(inventory._id, {
        $inc: { currentStock: -deduction.quantity },
      });

      results.push(`${deduction.category}: -${deduction.quantity}`);
    } catch (err) {
      // Don't fail the order status update if inventory deduction has issues
      console.error(`Inventory deduction error for ${deduction.category}:`, err);
    }
  }

  return results;
}

async function nextDispatchNumber() {
  const year = new Date().getFullYear();
  const count = await Dispatch.countDocuments({
    dispatchNo: { $regex: `^DISP-${year}-` },
  });
  return `DISP-${year}-${String(count + 1).padStart(3, "0")}`;
}

function getOrderJobType(order: any) {
  return order.finishing?.laminated ? "Printed+Laminated" : "Printed";
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstValue<T>(primary: T | undefined | null, fallback: T) {
  return primary === undefined || primary === null || primary === "" ? fallback : primary;
}

type BoxSpecSnapshot = {
  boxType?: string;
  boxesPerSheet?: number;
  itemSerialNumber?: string;
  dieSerialNumber?: string;
  length?: number;
  breadth?: number;
  height?: number;
  sheetLength?: number;
  sheetBreadth?: number;
};

type OrderConfigSnapshot = {
  duplexLength?: number;
  duplexBreadth?: number;
  duplexGsm?: number;
  duplexRate?: number;
  numberOf2Ply?: string;
  twoPlyGsm?: number;
  twoPlyRate?: number;
  printed?: boolean;
  laminated?: boolean;
  PrintingSize?: number;
  PrintingCost?: number;
  PrintingSheets?: number;
  lamRollSize?: number;
  lamSheetLength?: number;
  lamType?: string;
  fevicolCostPerSheet?: number;
  lamCostPerSheet?: number;
  sheeterRate?: number;
  pastingRate?: number;
  dieRate?: number;
  stitchingRate?: number;
  strappingRate?: number;
};

export const createOrder = async (req: any, res: any) => {
  console.log("========== CREATE ORDER ==========");
  console.log("BODY:");
  console.log(req.body);

  try {
    const body = req.body;
    const selectedItem = body.itemId ? await Item.findById(body.itemId).lean() : null;

    if (body.itemId && !selectedItem) {
      return res.status(400).json({
        success: false,
        message: "Selected item was not found",
      });
    }

    if (selectedItem) {
      const selectedCustomer = selectedItem.customer ? String(selectedItem.customer) : "";
      if (body.customerId && selectedCustomer !== String(body.customerId)) {
        return res.status(400).json({
          success: false,
          message: "Selected item is not linked to this customer",
        });
      }

      if (selectedItem.type !== "FinishedGood" || selectedItem.category !== "Finished Boxes") {
        return res.status(400).json({
          success: false,
          message: "Only linked finished goods can be used for order creation",
        });
      }
    }

    const boxSpec = (selectedItem?.boxSpecification || {}) as BoxSpecSnapshot;
    const config = (selectedItem?.orderConfigurations || {}) as OrderConfigSnapshot;
    const quantityOrdered = toNumber(body.quantityOrdered);
    const boxesPerSheet = toNumber(firstValue(boxSpec.boxesPerSheet, body.boxesPerSheet), 1) || 1;
    const duplexLength = toNumber(firstValue(config.duplexLength, body.duplexLength));
    const duplexBreadth = toNumber(firstValue(config.duplexBreadth, body.duplexBreadth));
    const duplexGsm = toNumber(firstValue(config.duplexGsm, body.duplexGsm));
    const duplexRate = toNumber(firstValue(config.duplexRate, body.duplexRate));
    const numberOf2Ply = String(firstValue(config.numberOf2Ply, body.numberOf2Ply || "0"));
    const twoPlyGsm = toNumber(firstValue(config.twoPlyGsm, body.twoPlyGsm));
    const twoPlyRate = toNumber(firstValue(config.twoPlyRate, body.twoPlyRate));
    const isPrinted = Boolean(firstValue(config.printed, body.printed || false));
    const isLaminated = Boolean(firstValue(config.laminated, body.laminated || false));
    const printingSheets = toNumber(firstValue(config.PrintingSheets, body.PrintingSheets));
    const printingCost = toNumber(firstValue(config.PrintingCost, body.PrintingCost));
    const printingTotalCost = isPrinted ? printingSheets * printingCost : 0;
    const lamCostPerSheet = toNumber(firstValue(config.lamCostPerSheet, body.lamCostPerSheet));
    const fevicolCostPerSheet = toNumber(firstValue(config.fevicolCostPerSheet, body.fevicolCostPerSheet));
    const sheetsRequired = quantityOrdered / boxesPerSheet;
    const duplexSheetWeight = ((duplexLength * duplexBreadth) / 1550) * (duplexGsm / 1000);
    const duplexTotalCost = duplexSheetWeight * sheetsRequired * duplexRate;
    const twoPlySheetWeight = ((duplexLength * duplexBreadth) / 1550) * (twoPlyGsm / 1000);
    const twoPlyTotalCost = twoPlySheetWeight * sheetsRequired * toNumber(numberOf2Ply) * twoPlyRate;
    const laminationTotalCost = isLaminated ? (lamCostPerSheet + fevicolCostPerSheet) * sheetsRequired : 0;
    const sheeterCost = toNumber(firstValue(config.sheeterRate, body.sheeterRate)) * toNumber(numberOf2Ply);
    const pastingCost = toNumber(firstValue(config.pastingRate, body.pastingRate)) * sheetsRequired;
    const dieCost = toNumber(firstValue(config.dieRate, body.dieRate)) * sheetsRequired;
    const stitchingCost = toNumber(firstValue(config.stitchingRate, body.stitchingRate)) * quantityOrdered;
    const strappingCost = toNumber(firstValue(config.strappingRate, body.strappingRate)) * (quantityOrdered / 50);
    const processingTotal = sheeterCost + pastingCost + dieCost + stitchingCost + strappingCost;
    const totalOrderCost = duplexTotalCost + twoPlyTotalCost + printingTotalCost + laminationTotalCost + processingTotal;

    const orderDoc = {
  orderInfo: {
    customerRef: body.customerId || selectedItem?.customer || null,
    itemRef: selectedItem?._id || body.itemId || null,
    orderNumber: body.orderNumber,
    customerName: body.customerName,
    itemBrand: selectedItem?.brand || body.itemBrand || "",
    itemName: selectedItem?.itemName || body.itemName,
    quantityOrdered,
  },
  boxSpecification: {
    boxType: firstValue(boxSpec.boxType, body.boxType || ""),
    boxesPerSheet,
    itemSerialNumber: firstValue(boxSpec.itemSerialNumber, body.itemSerialNumber || ""),
    dieSerialNumber: firstValue(boxSpec.dieSerialNumber, body.dieSerialNumber || ""),
    length: toNumber(firstValue(boxSpec.length, body.length)),
    breadth: toNumber(firstValue(boxSpec.breadth, body.breadth)),
    height: toNumber(firstValue(boxSpec.height, body.height)),
    sheetLength: toNumber(firstValue(boxSpec.sheetLength, body.sheetLength)),
    sheetBreadth: toNumber(firstValue(boxSpec.sheetBreadth, body.sheetBreadth)),
  },
  duplexCost: {
    length: duplexLength,
    breadth: duplexBreadth,
    gsm: duplexGsm,
    rate: duplexRate,
    area: duplexLength * duplexBreadth,
    sheetWeight: duplexSheetWeight,
    qtyRequiredSheets: sheetsRequired,
    cost: duplexTotalCost,
  },
  twoPlyCost: {
    numberOfPly: numberOf2Ply,
    gsmEachPly: twoPlyGsm,
    ratePerRoll: twoPlyRate,
    totalCost: twoPlyTotalCost,
  },
  finishing: {
    printed: isPrinted,
    laminated: isLaminated,
    PrintingSize: toNumber(firstValue(config.PrintingSize, body.PrintingSize)),
    PrintingSheets: printingSheets,
    PrintingCost: printingCost,
    lamRollSize: toNumber(firstValue(config.lamRollSize, body.lamRollSize)),
    lamSheetLength: toNumber(firstValue(config.lamSheetLength, body.lamSheetLength)),
    lamType: firstValue(config.lamType, body.lamType || "BOPP"),
    fevicolCostPerSheet,
    lamCostPerSheet,
    laminationCost: laminationTotalCost,
  },
  processing: {
    sheeterRate: toNumber(firstValue(config.sheeterRate, body.sheeterRate)),
    pastingRate: toNumber(firstValue(config.pastingRate, body.pastingRate)),
    dieRate: toNumber(firstValue(config.dieRate, body.dieRate)),
    stitchRate: toNumber(firstValue(config.stitchingRate, body.stitchingRate)),
    strapRate: toNumber(firstValue(config.strappingRate, body.strappingRate)),
    totalProcessingCost: processingTotal,
  },
  summary: {
    duplexCost: duplexTotalCost,
    twoPlyCost: twoPlyTotalCost,
    PrintingCost: printingTotalCost,
    laminationCost: laminationTotalCost,
    processingCost: processingTotal,
    perBoxCost: quantityOrdered > 0 ? totalOrderCost / quantityOrdered : 0,
    totalOrderCost,
  },
  status: "Pending" as const,
};

    console.log("ORDER DOC:");
    console.log(orderDoc);

    const order = await Order.create(orderDoc);

    console.log("ORDER SAVED");
    console.log(order);

    return res.status(201).json({
      success: true,
      data: flattenOrder(order),
    });
  } catch (error: any) {
    console.log("========== ERROR ==========");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOrders = async (req: any, res: any) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .lean();

    const flattened = orders.map(flattenOrder);

    // Sort: pending/active first, completed/dispatched/cancelled at the end
    const endStatuses = ["Completed", "Dispatched", "Cancelled"];
    flattened.sort((a, b) => {
      const aEnd = endStatuses.includes(a.status) ? 1 : 0;
      const bEnd = endStatuses.includes(b.status) ? 1 : 0;
      if (aEnd !== bEnd) return aEnd - bEnd;
      // Within same group, sort by newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.status(200).json({
      success: true,
      data: flattened,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateOrderStatus = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "Pending",
      "Approved",
      "In Production",
      "Completed",
      "Dispatched",
      "Cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Get the current order to check previous status
    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const previousStatus = currentOrder.status;

    // Build update fields
    const updateFields: any = { status };

    // If completing, auto-set delivery to 100%
    if (status === "Completed") {
      const totalOrdered = currentOrder.orderInfo?.quantityOrdered || 0;
      updateFields.quantityDelivered = totalOrdered;
    }

    // Update the status
    const order = await Order.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    ).lean();

    // If transitioning TO "Completed" (and wasn't already completed), deduct inventory
    let inventoryDeductions: string[] = [];
    if (
      status === "Completed" &&
      previousStatus !== "Completed" &&
      previousStatus !== "Dispatched"
    ) {
      inventoryDeductions = await deductInventoryOnCompletion(order);
    }

    res.status(200).json({
      success: true,
      data: flattenOrder(order),
      inventoryDeductions,
    });
  } catch (error: any) {
    console.error("updateOrderStatus error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update the delivered quantity for an order.
 * If fully delivered, auto-set status to "Completed".
 */
export const updateDelivery = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { quantityDelivered } = req.body;

    if (quantityDelivered == null || isNaN(Number(quantityDelivered)) || Number(quantityDelivered) < 0) {
      return res.status(400).json({
        success: false,
        message: "quantityDelivered must be a non-negative number",
      });
    }

    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const totalOrdered = currentOrder.orderInfo?.quantityOrdered || 0;
    const delivered = Number(quantityDelivered);

    if (delivered > totalOrdered) {
      return res.status(400).json({
        success: false,
        message: `Cannot deliver more than ordered (${totalOrdered})`,
      });
    }

    const updateFields: any = { quantityDelivered: delivered };

    // Auto-complete the order if fully delivered
    const previousStatus = currentOrder.status;
    if (delivered >= totalOrdered && previousStatus !== "Completed" && previousStatus !== "Dispatched" && previousStatus !== "Cancelled") {
      updateFields.status = "Completed";
    }

    const order = await Order.findByIdAndUpdate(id, updateFields, { new: true }).lean();

    // If auto-completed, deduct inventory
    let inventoryDeductions: string[] = [];
    if (
      updateFields.status === "Completed" &&
      previousStatus !== "Completed" &&
      previousStatus !== "Dispatched"
    ) {
      inventoryDeductions = await deductInventoryOnCompletion(order);
    }

    res.status(200).json({
      success: true,
      data: flattenOrder(order),
      inventoryDeductions,
    });
  } catch (error: any) {
    console.error("updateDelivery error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createJobWorkFromOrder = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { inventoryRef, quantity, jobNumber } = req.body;

    if (!inventoryRef) {
      return res.status(400).json({
        success: false,
        message: "inventoryRef is required",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.finishing?.printed) {
      return res.status(400).json({
        success: false,
        message: "Only printed orders can be sent to job work",
      });
    }

    if ((order as any).jobWorkRef) {
      return res.status(400).json({
        success: false,
        message: "Order is already linked to a job work",
      });
    }

    const qty = Number(quantity) || order.orderInfo?.quantityOrdered || 0;
    if (!qty || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "quantity must be a positive number",
      });
    }

    const inventory = await Inventory.findById(inventoryRef).populate("itemRef");
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    if (inventory.currentStock < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${inventory.currentStock}, Requested: ${qty}`,
      });
    }

    const itemDoc = inventory.itemRef as any;
    const materialName = itemDoc?.itemName || itemDoc?.name || "Unknown Material";
    const resolvedJobNumber =
      typeof jobNumber === "string" && jobNumber.trim() !== ""
        ? jobNumber.trim()
        : `JOB-${order.orderInfo?.orderNumber || String(order._id).slice(-6)}`;
    const jobType = getOrderJobType(order);

    await Inventory.findByIdAndUpdate(inventoryRef, {
      $inc: { currentStock: -qty },
    });

    await StockTransaction.create({
      inventoryRef,
      type: "OUT",
      quantity: qty,
      referenceNumber: resolvedJobNumber,
      notes: `Order ${order.orderInfo?.orderNumber || ""} sent to ${jobType} job work`,
    });

    const job = await JobWork.create({
      jobNumber: resolvedJobNumber,
      jobType,
      inventoryRef,
      sourceOrderRef: order._id,
      materialName,
      quantity: qty,
      status: "Pending",
    });

    order.jobWorkRef = job._id as any;
    order.productionStage = "Sent to Job Work";
    order.status = "In Production";
    await order.save();

    const populatedJob = await JobWork.findById(job._id)
      .populate({
        path: "inventoryRef",
        populate: { path: "itemRef" },
      })
      .lean();

    res.status(201).json({
      success: true,
      data: {
        order: flattenOrder(order),
        job: populatedJob,
      },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Job number already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteOrder = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if ((order as any).jobWorkRef) {
      return res.status(400).json({
        success: false,
        message:
          "This order has been sent to job work and cannot be deleted. Orders can only be deleted before they are sent to job work.",
      });
    }

    if (order.status === "Dispatched" || (order as any).dispatchRef) {
      return res.status(400).json({
        success: false,
        message: "Dispatched orders cannot be deleted.",
      });
    }

    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Order deleted",
    });
  } catch (error: any) {
    console.error("deleteOrder error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createDispatchFromOrder = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const {
      customerAddress,
      dispatchDate,
      quantity,
      senderName,
      corrugatedRollInventoryId,
      corrugatedLength,
      corrugatedNoOf2Ply,
      corrugatedTotalSheets,
    } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if ((order as any).dispatchRef) {
      return res.status(400).json({
        success: false,
        message: "Order is already linked to a dispatch",
      });
    }

    const isPrintedOrder = Boolean(order.finishing?.printed);
    const productionStage = (order as any).productionStage || "Not Started";
    const printedReadyStages = ["Printed", "Printed & Laminated"];
    if (isPrintedOrder && !printedReadyStages.includes(productionStage)) {
      return res.status(400).json({
        success: false,
        message: "Printed orders can be dispatched only after job work is completed",
      });
    }

    const qtyOrdered = order.orderInfo?.quantityOrdered || 0;
    const qtyDelivered = (order as any).quantityDelivered || 0;
    const qtyRemaining = Math.max(0, qtyOrdered - qtyDelivered);
    const dispatchQty = Number(quantity) || qtyRemaining || qtyOrdered;
    const maxDispatchQty = qtyRemaining > 0 ? qtyRemaining : qtyOrdered;

    if (!dispatchQty || dispatchQty <= 0) {
      return res.status(400).json({
        success: false,
        message: "quantity must be a positive number",
      });
    }

    if (dispatchQty > maxDispatchQty) {
      return res.status(400).json({
        success: false,
        message: `Cannot dispatch more than remaining (${maxDispatchQty})`,
      });
    }

    if (typeof customerAddress !== "string" || customerAddress.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "customerAddress is required",
      });
    }

    // For printed orders, resolve and validate the finished printed-stock that
    // the completed job work produced. We deduct this on dispatch (raw material
    // was already deducted when the order was sent to job work).
    let printedInventoryId: any = null;
    if (isPrintedOrder) {
      const jobWork = (order as any).jobWorkRef
        ? await JobWork.findById((order as any).jobWorkRef)
        : null;
      const outputInventoryRef = (jobWork as any)?.outputInventoryRef;

      if (!outputInventoryRef) {
        return res.status(400).json({
          success: false,
          message: "Printed stock not found. Complete the job work before dispatching.",
        });
      }

      const printedInventory = await Inventory.findById(outputInventoryRef);
      if (!printedInventory) {
        return res.status(400).json({
          success: false,
          message: "Printed stock inventory record not found.",
        });
      }

      if (printedInventory.currentStock < dispatchQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient printed stock. Available: ${printedInventory.currentStock}, Requested: ${dispatchQty}`,
        });
      }

      printedInventoryId = printedInventory._id;
    }

    let corrugatedDeduction:
      | {
          inventoryId: any;
          qty: number;
          rollName: string;
          reelSize: number;
          gsm: number;
          length: number;
          noOf2Ply: number;
          totalSheets: number;
        }
      | null = null;
    if (corrugatedRollInventoryId) {
      const roll = await Inventory.findById(corrugatedRollInventoryId).populate("itemRef");
      if (!roll) {
        return res.status(404).json({
          success: false,
          message: "Selected corrugated roll not found",
        });
      }

      const rollItem = roll.itemRef as any;
      const reelSize = parseLeadingNumber(rollItem?.specifications?.dimensions);
      const gsm = Number(rollItem?.specifications?.gsm) || 0;
      const length = Number(corrugatedLength) || 0;
      const noOf2Ply = Number(corrugatedNoOf2Ply) || 0;
      const totalSheets = Number(corrugatedTotalSheets) || 0;

      if (reelSize <= 0) {
        return res.status(400).json({
          success: false,
          message: "Selected corrugated roll has no numeric reel size in its dimensions.",
        });
      }
      if (gsm <= 0 || length <= 0 || noOf2Ply <= 0 || totalSheets <= 0) {
        return res.status(400).json({
          success: false,
          message: "Corrugated roll deduction needs GSM, length, no. of 2-ply and total sheets as positive numbers.",
        });
      }

      const deductQty =
        Math.round(computeCorrugatedDeduction(reelSize, length, gsm, noOf2Ply, totalSheets) * 100) / 100;
      if (deductQty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Computed corrugated roll deduction is zero.",
        });
      }
      if (roll.currentStock < deductQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient corrugated roll stock. Available: ${roll.currentStock}, Required: ${deductQty}`,
        });
      }

      corrugatedDeduction = {
        inventoryId: roll._id,
        qty: deductQty,
        rollName: rollItem?.itemName || "Corrugated Roll",
        reelSize,
        gsm,
        length,
        noOf2Ply,
        totalSheets,
      };
    }

    const dispatch = await Dispatch.create({
      dispatchNo: await nextDispatchNumber(),
      dispatchDate: dispatchDate || new Date().toISOString().slice(0, 10),
      customerName: order.orderInfo?.customerName || "",
      customerAddress: customerAddress.trim(),
      senderName: senderName || "Amar Packers",
      sourceOrderRef: order._id,
      status: "Pending",
      items: [
        {
          id: String(order._id),
          itemName: order.orderInfo?.itemName || "",
          brand: order.orderInfo?.itemBrand || "",
          boxName: order.boxSpecification?.boxType || order.orderInfo?.itemName || "",
          quantity: dispatchQty,
        },
      ],
      corrugatedConsumption: corrugatedDeduction
        ? {
            rollName: corrugatedDeduction.rollName,
            quantityKg: corrugatedDeduction.qty,
            reelSize: corrugatedDeduction.reelSize,
            gsm: corrugatedDeduction.gsm,
            length: corrugatedDeduction.length,
            noOf2Ply: corrugatedDeduction.noOf2Ply,
            totalSheets: corrugatedDeduction.totalSheets,
          }
        : undefined,
    });

    // Deduct the finished printed item from inventory and log the OUT movement.
    if (printedInventoryId) {
      await Inventory.findByIdAndUpdate(printedInventoryId, {
        $inc: { currentStock: -dispatchQty },
      });

      await StockTransaction.create({
        inventoryRef: printedInventoryId,
        type: "OUT",
        quantity: dispatchQty,
        referenceNumber: dispatch.dispatchNo,
        notes: `Order ${order.orderInfo?.orderNumber || ""} dispatched — ${dispatchQty} units of printed stock`,
      });
    }

    // Deduct the corrugated roll consumed for the paste-up.
    if (corrugatedDeduction) {
      await Inventory.findByIdAndUpdate(corrugatedDeduction.inventoryId, {
        $inc: { currentStock: -corrugatedDeduction.qty },
      });

      await StockTransaction.create({
        inventoryRef: corrugatedDeduction.inventoryId,
        type: "OUT",
        quantity: corrugatedDeduction.qty,
        referenceNumber: dispatch.dispatchNo,
        notes: `Order ${order.orderInfo?.orderNumber || ""} dispatched — ${corrugatedDeduction.qty} KG of ${corrugatedDeduction.rollName} consumed for paste-up`,
      });
    }

    order.dispatchRef = dispatch._id as any;
    order.status = "Dispatched";
    order.quantityDelivered = Math.min(qtyOrdered, qtyDelivered + dispatchQty);
    await order.save();

    res.status(201).json({
      success: true,
      data: {
        order: flattenOrder(order),
        dispatch,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
