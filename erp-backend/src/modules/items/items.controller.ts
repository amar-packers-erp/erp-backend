import { Request, Response } from "express";
import Item from "../../models/item.model";

export const getAllItems = async (req: Request, res: Response) => {
  try {
    const customerId = (req.query.customerId || req.query.customer) as string | undefined;
    const filter = customerId ? { customer: customerId } : {};
    
    const items = await Item.find(filter)
      .populate("customer", "companyName contactPerson")
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createItem = async (req: Request, res: Response) => {
  try {
    const { itemName, brand, customer, type, category, itemSpecification, boxSpecification, unitOfMeasure, orderConfigurations } = req.body;

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
      customer,
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
    const { itemName, brand, customer, type, category, itemSpecification, boxSpecification, unitOfMeasure, orderConfigurations } = req.body;

    const item = await Item.findByIdAndUpdate(
      id,
      {
        itemName,
        brand,
        customer: customer || null,
        type,
        category,
        specifications: itemSpecification || {},
        boxSpecification: boxSpecification || {},
        orderConfigurations: orderConfigurations || {},
        unitOfMeasure,
      },
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
