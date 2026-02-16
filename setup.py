import os

ROOT_DIR = "fairlens-bnpl"

structure = {
    "frontend": {
        "public": {},
        "src": {
            "pages": {
                "index.tsx": "",
                "user-dashboard.tsx": "",
                "admin-dashboard.tsx": ""
            },
            "components": {
                "InputForm.tsx": "",
                "RiskMeter.tsx": "",
                "ExplanationCard.tsx": "",
                "FairnessChart.tsx": "",
                "DriftStatus.tsx": ""
            },
            "services": {
                "api.ts": ""
            }
        },
        "package.json": "",
        "next.config.js": ""
    },

    "backend": {
        "main.py": "# Backend FastAPI entry point\n",
        "requirements.txt": "",
        "run.py": "# Script to start backend server\n"
    },

    "ml-service": {
        "main.py": "# ML FastAPI inference service\n",
        "train_model.py": "# Script to train logistic regression model\n",
        "synthetic_data.py": "# Script to generate synthetic training data\n",
        "model": {
            "trained_model.pkl": "",
            "scaler.pkl": ""
        },
        "requirements.txt": "",
        "run.py": "# Script to start ML service\n"
    },

    "data": {
        "synthetic_training_data.csv": ""
    },

    "README.md": "# FairLens BNPL Responsible AI Project\n",
    "requirements.txt": ""
}


def create_structure(base_path, structure_dict):
    for name, content in structure_dict.items():
        path = os.path.join(base_path, name)

        if isinstance(content, dict):
            os.makedirs(path, exist_ok=True)
            create_structure(path, content)
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)


def main():
    print(f"Creating project structure in '{ROOT_DIR}'...")
    os.makedirs(ROOT_DIR, exist_ok=True)
    create_structure(ROOT_DIR, structure)
    print("Directory structure created successfully.")


if __name__ == "__main__":
    main()
