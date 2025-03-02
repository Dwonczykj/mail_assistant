import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

export enum AuthProvider {
    GOOGLE = 'google',
    MICROSOFT = 'microsoft',
    LOCAL = 'local'
}

const redirectUrisSeparator = ' ; ';

@Entity('auth_users')
export class AuthUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({
        type: 'varchar',
        enum: AuthProvider,
        default: AuthProvider.LOCAL
    })
    provider!: AuthProvider;

    @Column({ nullable: true })
    providerId!: string;

    @Column({ nullable: true })
    accessToken!: string;

    @Column({ nullable: true })
    refreshToken!: string;

    @Column({ nullable: true })
    redirectUris!: string;

    @Column({ nullable: true })
    expiryDate!: Date;

    @Column({ nullable: false })
    userId!: string;

    @ManyToOne(() => User, user => user.authUsers, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    setRedirectUris(data: string[]) {
        this.redirectUris = data.join(redirectUrisSeparator);
    }

    getRedirectUris(): string[] {
        return this.redirectUris.split(redirectUrisSeparator);
    }
} 