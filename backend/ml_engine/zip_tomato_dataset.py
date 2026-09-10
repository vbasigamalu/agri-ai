"""
Agri-AI — Package Tomato Dataset (10 Classes) for Google Colab
"""
import zipfile
from pathlib import Path
import sys

# Force UTF-8 on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def main():
    root = Path(__file__).resolve().parent.parent
    dataset_dir = root / "dataset"
    output_zip = root / "ml_engine" / "tomato_dataset.zip"

    print("=" * 60)
    print("🍅 Agri-AI: Packaging 10 Tomato Classes for Google Colab")
    print("=" * 60)

    if not dataset_dir.exists():
        print(f"❌ Error: Dataset directory not found at {dataset_dir}")
        sys.exit(1)

    tomato_dirs = sorted([
        d for d in dataset_dir.iterdir()
        if d.is_dir() and d.name.startswith("Tomato___")
    ])

    if len(tomato_dirs) != 10:
        print(f"⚠️ Warning: Found {len(tomato_dirs)} Tomato classes (expected 10).")

    MAX_PER_CLASS = 1000
    import random
    random.seed(42)

    if output_zip.exists():
        try:
            output_zip.unlink()
        except Exception:
            pass

    total_files = 0
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_STORED) as zipf:
        for cls_dir in tomato_dirs:
            files = [f for f in cls_dir.iterdir() if f.is_file() and f.suffix.lower() in {".jpg", ".jpeg", ".png"}]
            if len(files) > MAX_PER_CLASS:
                files = random.sample(files, MAX_PER_CLASS)
            print(f"   ➕ {cls_dir.name:<46}: {len(files)} images")
            for f in files:
                arcname = f"dataset/{cls_dir.name}/{f.name}"
                try:
                    zipf.write(f, arcname)
                    total_files += 1
                except (OSError, Exception) as err:
                    print(f"      ⚠️ Skipped {f.name}: {err}")

    size_mb = output_zip.stat().st_size / (1024 * 1024)
    print("\n" + "=" * 60)
    print(f"✅ Success! Created: {output_zip.name}")
    print(f"   Total Images : {total_files}")
    print(f"   Archive Size : {size_mb:.1f} MB")
    print(f"   Location     : {output_zip}")
    print("=" * 60)

if __name__ == "__main__":
    main()
