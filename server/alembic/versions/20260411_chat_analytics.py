"""add ip_address and user_agent to chat_messages

Revision ID: 20260411_chat_analytics
Revises: None
Create Date: 2026-04-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260411_chat_analytics"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.add_column(sa.Column("ip_address", sa.String(45), nullable=True))
        batch_op.add_column(sa.Column("user_agent", sa.String(512), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.drop_column("user_agent")
        batch_op.drop_column("ip_address")
