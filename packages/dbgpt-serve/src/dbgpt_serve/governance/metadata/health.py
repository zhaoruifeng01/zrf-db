"""Deterministic semantic metadata health scoring."""

from typing import Dict


def calculate_metadata_health(inputs: Dict) -> Dict:
    """Return an explainable metadata health score from repository inputs."""
    tables = inputs.get("tables", [])
    columns = inputs.get("columns", [])
    metrics_count = inputs.get("metrics_count", 0)
    relationships_count = inputs.get("relationships_count", 0)

    if not tables:
        return {
            "score": 0.0,
            "details": {
                "table_coverage": 0.0,
                "column_coverage": 0.0,
                "description_coverage": 0.0,
                "relationship_bonus": 0.0,
                "metric_bonus": 0.0,
            },
        }

    tables_with_columns = {column["table_name"] for column in columns}
    table_coverage = len(tables_with_columns) / max(len(tables), 1)
    columns_with_type = [
        column for column in columns if column.get("data_type") not in (None, "")
    ]
    column_coverage = len(columns_with_type) / max(len(columns), 1)
    described_columns = [column for column in columns if column.get("comment")]
    described_tables = [table for table in tables if table.get("description")]
    description_denominator = max(len(tables) + len(columns), 1)
    description_coverage = (
        len(described_tables) + len(described_columns)
    ) / description_denominator
    relationship_bonus = 1.0 if relationships_count > 0 else 0.0
    metric_bonus = 1.0 if metrics_count > 0 else 0.0

    score = (
        table_coverage * 35
        + column_coverage * 35
        + description_coverage * 20
        + relationship_bonus * 5
        + metric_bonus * 5
    )
    return {
        "score": round(score, 2),
        "details": {
            "table_coverage": round(table_coverage, 4),
            "column_coverage": round(column_coverage, 4),
            "description_coverage": round(description_coverage, 4),
            "relationship_bonus": relationship_bonus,
            "metric_bonus": metric_bonus,
        },
    }
