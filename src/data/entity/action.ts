import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class EmailAction {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    actionName!: string;

    @Column()
    emailId!: string;

    @Column()
    createdAt!: Date;
}