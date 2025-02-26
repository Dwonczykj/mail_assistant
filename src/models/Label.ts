export interface ILabel {
    name: string;
    description: string;
    parent?: ILabel | null;
}

class Label implements ILabel {
    constructor(public name: string, public description: string, public parent?: ILabel | null) {
    }
}

export const LABELS: ILabel[] = [
    { name: "Primary", description: "Primary email" },
    { name: "Work", description: "Work email" },
    { name: "Personal", description: "Personal email" },
    { name: "Social", description: "Social email" },
    { name: "Newsletter", description: "Newsletter email" },
    { name: "Updates", description: "Updates email" },
    { name: "Promotions", description: "Promotions email" },
    { name: "Spam", description: "Spam email" },
    { name: "Finance", description: "Finance email" },
    { name: "Client", description: "Client email" },
    { name: "Invoice", description: "Invoice email" },
    { name: "Shipping", description: "Shipping email" },
    { name: "Order", description: "Order email" },
    { name: "Receipt", description: "Receipt email" },
    { name: "Other", description: "Other email" }
]



export class LabelFactory {
    static getLabel(name: string): ILabel {
        const label = LABELS.find(label => label.name === name);
        if (!label) {
            throw new Error(`Label ${name} not found`);
        }
        return new Label(label.name, label.description, label.parent);
    }

    static isValidLabel(labelName: string): boolean {
        return LABELS.some(label => label.name === labelName);
    }
}