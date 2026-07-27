import { Request, Response } from "express";
import Item from "../../models/item.model";
import mongoose from "mongoose";

const buildCustomerFilter = (value: unknown) => {
  if (!value || typeof value !== "string") return {};
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error("Invalid customer id");
  }
  return { customer: value };
};

export const getAllItems = async (req: Request, res: Response) => {
  try {
    const customerId = req.query.customerId || req.query.customer;
    const orderable = req.query.orderable === "true";
    const filter: Record<string, unknown> = {
      ...buildCustomerFilter(customerId),
      ...(orderable ? { type: "FinishedGood", category: "Finished Boxes" } : {}),
    };

    const items = await Item.find(filter)
      .populate("customer", "companyName contactPerson")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    const status = error.message === "Invalid customer id" ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const createItem = async (req: Request, res: Response) => {
  try {
    const { itemName, brand, customer, type, category, itemSpecification, boxSpecification, orderConfigurations, unitOfMeasure } = req.body;

    if (!itemName) {
      res.status(400).json({ success: false, message: "itemName is required" });
      return;
    }

    // Auto-generate itemCode from category initials
    const initials = category
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .substring(0, 3);
    const itemCode = `${initials}-${Math.floor(Math.random() * 9000) + 1000}`;

    const item = await Item.create({
      itemCode,
      itemName,
      brand,
      customer: customer || null,
      type,
      category,
      specifications: itemSpecification || {},
      boxSpecification: boxSpecification || {},
      orderConfigurations: orderConfigurations || {},
      unitOfMeasure,
    });

    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { itemName, brand, customer, type, category, itemSpecification, boxSpecification, orderConfigurations, unitOfMeasure } = req.body;
    const update: Record<string, unknown> = {
      itemName,
      brand,
      type,
      category,
      specifications: itemSpecification || {},
      boxSpecification: boxSpecification || {},
      unitOfMeasure,
    };

    if (Object.prototype.hasOwnProperty.call(req.body, "orderConfigurations")) {
      update.orderConfigurations = orderConfigurations || {};
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "customer")) {
      update.customer = customer || null;
    }

    const item = await Item.findByIdAndUpdate(
      id,
      update,
      { new: true }
    );

    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }

    res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await Item.findByIdAndDelete(id);
    if (!item) {
      res.status(404).json({ success: false, message: "Item not found" });
      return;
    }
    res.status(200).json({ success: true, data: { _id: id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
