"""pivot schema to virtual flower gifting

Revision ID: 20260225_0004
Revises: 20260222_0003
Create Date: 2026-02-25 00:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260225_0004"
down_revision: str | None = "20260222_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop legacy plant/social domain tables.
    op.drop_table("user_badges")
    op.drop_table("post_media")
    op.drop_table("comments")
    op.drop_table("likes")
    op.drop_table("posts")
    op.drop_table("plant_photos")
    op.drop_table("follows")
    op.drop_table("badges")
    op.drop_table("plants")

    # Core gifting artifact.
    op.create_table(
        "flowers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("flower_type", sa.String(length=32), server_default=sa.text("'rose'"), nullable=False),
        sa.Column("status", sa.String(length=16), server_default=sa.text("'growing'"), nullable=False),
        sa.Column("stage", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("water_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("streak_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_watered_on", sa.Date(), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flowers_owner_id_status", "flowers", ["owner_id", "status"], unique=False)

    # Daily "watering" drops.
    op.create_table(
        "flower_drops",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("flower_id", sa.Integer(), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("drop_type", sa.String(length=16), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("media_url", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("prompt_key", sa.String(length=64), nullable=True),
        sa.Column("mood_tags", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["flower_id"], ["flowers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("flower_id", "day_number", name="uq_flower_drops_flower_day_number"),
    )
    op.create_index(
        "ix_flower_drops_flower_id_created_at",
        "flower_drops",
        ["flower_id", "created_at"],
        unique=False,
    )

    # Single share artifact per flower.
    op.create_table(
        "flower_deliveries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("flower_id", sa.Integer(), nullable=False),
        sa.Column("share_token", sa.String(length=64), nullable=False),
        sa.Column("recipient_name", sa.String(length=80), nullable=True),
        sa.Column("recipient_contact", sa.String(length=255), nullable=True),
        sa.Column("delivery_mode", sa.String(length=16), server_default=sa.text("'instant'"), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["flower_id"], ["flowers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("flower_id", name="uq_flower_deliveries_flower_id"),
        sa.UniqueConstraint("share_token"),
    )
    op.create_index("ix_flower_deliveries_share_token", "flower_deliveries", ["share_token"], unique=False)
    op.create_index("ix_flower_deliveries_scheduled_for", "flower_deliveries", ["scheduled_for"], unique=False)

    op.create_table(
        "delivery_reactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("delivery_id", sa.Integer(), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["delivery_id"], ["flower_deliveries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("delivery_id", "emoji", name="uq_delivery_reactions_delivery_emoji"),
    )
    op.create_index("ix_delivery_reactions_delivery_id", "delivery_reactions", ["delivery_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_delivery_reactions_delivery_id", table_name="delivery_reactions")
    op.drop_table("delivery_reactions")

    op.drop_index("ix_flower_deliveries_scheduled_for", table_name="flower_deliveries")
    op.drop_index("ix_flower_deliveries_share_token", table_name="flower_deliveries")
    op.drop_table("flower_deliveries")

    op.drop_index("ix_flower_drops_flower_id_created_at", table_name="flower_drops")
    op.drop_table("flower_drops")

    op.drop_index("ix_flowers_owner_id_status", table_name="flowers")
    op.drop_table("flowers")

    op.create_table(
        "follows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("follower_id", sa.Integer(), nullable=False),
        sa.Column("followee_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["followee_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["follower_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("follower_id", "followee_id", name="uq_follow"),
    )
    op.create_index("ix_follows_followee_id", "follows", ["followee_id"], unique=False)

    op.create_table(
        "plants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("species", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plants_owner_id", "plants", ["owner_id"], unique=False)

    op.create_table(
        "badges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    op.create_table(
        "plant_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("taken_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("ai_health_score", sa.Integer(), nullable=True),
        sa.Column("ai_issues", sa.Text(), nullable=True),
        sa.Column("ai_recommendations", sa.Text(), nullable=True),
        sa.Column("model_version", sa.String(length=40), nullable=True),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plant_photos_plant_id", "plant_photos", ["plant_id"], unique=False)

    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_posts_author_id", "posts", ["author_id"], unique=False)

    op.create_table(
        "likes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "post_id", name="uq_like"),
    )
    op.create_index("ix_likes_post_id", "likes", ["post_id"], unique=False)

    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_comments_post_id", "comments", ["post_id"], unique=False)

    op.create_table(
        "post_media",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_post_media_post_id", "post_media", ["post_id"], unique=False)

    op.create_table(
        "user_badges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("badge_id", sa.Integer(), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["badge_id"], ["badges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
    )
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"], unique=False)
