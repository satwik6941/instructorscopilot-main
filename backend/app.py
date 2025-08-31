from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import os
import json
import shutil
import subprocess
import asyncio
import platform
from pathlib import Path
from typing import Optional, List, Dict
import logging
from datetime import datetime
import base64

# Set environment variables for proper encoding
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Instructors Copilot API", version="1.0.0")

# CORS middleware to allow frontend to connect
cors_env = os.environ.get("BACKEND_CORS_ORIGINS", "")
extra_origins = [o.strip() for o in cors_env.split(",") if o.strip()]

# Get Vercel URL from environment or use default
vercel_url = os.environ.get("VERCEL_URL", "instructorscopilot-main-lovat.vercel.app")
if not vercel_url.startswith("http"):
    vercel_url = f"https://{vercel_url}"

default_origins = [
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        vercel_url,
        "https://instructorscopilot-main-lovat.vercel.app",
        # Add common Vercel patterns for your app
        "https://instructorscopilot-main.vercel.app",
        "https://instructorscopilot-main-git-main-theryanpereira.vercel.app",
]

# Add any additional origins from environment
if extra_origins:
    default_origins.extend(extra_origins)

allow_origins = list(set(default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist and create backup structure
UPLOAD_DIR = Path("Inputs and Outputs")
UPLOAD_DIR.mkdir(exist_ok=True)

# Create backup directory for file persistence
BACKUP_DIR = Path("backup_files")
BACKUP_DIR.mkdir(exist_ok=True)

# Also ensure known category subdirectories exist to avoid downstream issues
CATEGORIES = ["course material", "quizzes", "ppts", "flashcards"]
for sub in CATEGORIES:
    (UPLOAD_DIR / sub).mkdir(exist_ok=True)
    (BACKUP_DIR / sub).mkdir(exist_ok=True)

def backup_generated_files():
    """Backup generated files to ensure persistence"""
    try:
        logger.info("Creating backup of generated files...")
        for category in CATEGORIES:
            source_dir = UPLOAD_DIR / category
            backup_category_dir = BACKUP_DIR / category
            
            if source_dir.exists():
                for file_path in source_dir.glob("*"):
                    if file_path.is_file():
                        backup_file_path = backup_category_dir / file_path.name
                        shutil.copy2(file_path, backup_file_path)
                        logger.info(f"Backed up {file_path.name} to {category}")
                        
        # Also backup files in root directory
        for file_path in UPLOAD_DIR.glob("*"):
            if file_path.is_file() and file_path.suffix in ['.txt', '.docx', '.pdf', '.pptx']:
                backup_file_path = BACKUP_DIR / file_path.name
                shutil.copy2(file_path, backup_file_path)
                logger.info(f"Backed up {file_path.name} to root backup")
                
    except Exception as e:
        logger.error(f"Backup failed: {e}")

def restore_files_from_backup():
    """Restore files from backup if main directory is empty"""
    try:
        logger.info("Checking if file restoration is needed...")
        
        # Check if we need to restore files
        main_files_exist = any(UPLOAD_DIR.glob("**/*"))
        backup_files_exist = any(BACKUP_DIR.glob("**/*"))
        
        if not main_files_exist and backup_files_exist:
            logger.info("Restoring files from backup...")
            
            # Restore category files
            for category in CATEGORIES:
                backup_category_dir = BACKUP_DIR / category
                source_dir = UPLOAD_DIR / category
                
                if backup_category_dir.exists():
                    for backup_file in backup_category_dir.glob("*"):
                        if backup_file.is_file():
                            restore_path = source_dir / backup_file.name
                            shutil.copy2(backup_file, restore_path)
                            logger.info(f"Restored {backup_file.name} to {category}")
            
            # Restore root files
            for backup_file in BACKUP_DIR.glob("*"):
                if backup_file.is_file() and backup_file.suffix in ['.txt', '.docx', '.pdf', '.pptx']:
                    restore_path = UPLOAD_DIR / backup_file.name
                    shutil.copy2(backup_file, restore_path)
                    logger.info(f"Restored {backup_file.name} to root")
                    
            return True
        return False
    except Exception as e:
        logger.error(f"File restoration failed: {e}")
        return False
@app.get("/")
async def root():
    """Health check endpoint"""
    # Try to restore files on startup if needed
    restore_files_from_backup()
    return {"message": "Instructors Copilot API is running"}

@app.post("/upload-curriculum/")
async def upload_curriculum(
    file: UploadFile = File(...),
    user_name: str = Form(...),
    user_id: str = Form(...),
    course_topic: str = Form(...),
    no_of_weeks: int = Form(...),
    difficulty_level: str = Form(...),
    teaching_style: str = Form(...)
):
    """
    Upload curriculum PDF and create user configuration
    """
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Save the uploaded PDF file
        pdf_file_path = UPLOAD_DIR / "curriculum.pdf"
        
        # Remove existing curriculum file if it exists
        if pdf_file_path.exists():
            pdf_file_path.unlink()
        
        # Save the new file
        with open(pdf_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"PDF file saved: {pdf_file_path}")
        
        # Create user configuration JSON
        user_config = {
            "user_name": user_name,
            "user_id": user_id,
            "course_topic": course_topic,
            "difficulty_level": difficulty_level,
            "duration": no_of_weeks,  # Backend expects 'duration' field
            "teaching_style": teaching_style,
            "created_at": datetime.now().isoformat(),
            "curriculum_file": str(pdf_file_path)
        }
        
        # Save user config
        config_file_path = Path("user_config.json")
        with open(config_file_path, 'w', encoding='utf-8') as f:
            json.dump(user_config, f, indent=2)
        
        logger.info(f"User config saved: {config_file_path}")
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "File uploaded and configuration saved successfully",
                "file_name": file.filename,
                "config": user_config
            }
        )
        
    except Exception as e:
        logger.error(f"Error in upload_curriculum: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/generate-content/")
async def generate_content():
    """
    Run the shell script directly to generate course content
    """
    try:
        # Check if user config exists
        config_file_path = Path("user_config.json")
        if not config_file_path.exists():
            raise HTTPException(status_code=400, detail="No user configuration found. Please upload curriculum first.")
        
        # Check if curriculum PDF exists
        pdf_file_path = UPLOAD_DIR / "curriculum.pdf"
        if not pdf_file_path.exists():
            raise HTTPException(status_code=400, detail="No curriculum PDF found. Please upload curriculum first.")
        
        # Remove any previous completion marker to signal new run
        try:
            marker = UPLOAD_DIR / "generation_complete.json"
            if marker.exists():
                marker.unlink()
        except Exception as e:
            logger.warning(f"Failed clearing generation_complete.json: {e}")

        # Resolve backend directory and select script per platform
        backend_dir = Path(__file__).resolve().parent
        if platform.system() == "Windows":
            script_to_run = backend_dir / "start.bat"
            script_type = "batch"
        else:  # Linux/Unix (Render)
            script_to_run = backend_dir / "start.sh"
            script_type = "shell"
        
        if not script_to_run.exists():
            raise HTTPException(
                status_code=400, 
                detail=f"{script_to_run.name} script not found in backend directory. Platform: {platform.system()}"
            )
        
        logger.info(f"Starting AI Copilot for Instructors using {script_to_run} script...")
        
        # Set environment variables to prevent port conflicts
        env = os.environ.copy()
        env.update({
            'NO_SERVER': '1',
            'DISABLE_SERVICES': '1',
            'PYTHONUNBUFFERED': '1'
        })
        # Ensure child processes do not inherit the web service PORT
        if 'PORT' in env:
            logger.info("Removing PORT from child environment to avoid port conflicts during generation")
            env.pop('PORT', None)
        
        # Check for required environment variables
        if not env.get('GEMINI_API_KEY') and not env.get('GOOGLE_API_KEY'):
            logger.warning("GEMINI_API_KEY not found in environment variables")
        
        # Execute the script directly
        try:
            logger.info(f"Executing {script_type} script: {script_to_run}")
            
            if script_type == "batch":
                # On Windows, run the batch file directly with proper sequential execution
                result = subprocess.run(
                    [str(script_to_run)],
                    cwd=backend_dir,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    shell=True,  # Use shell for batch files
                    env=env,
                    timeout=3600  # 1 hour timeout
                )
            else:
                # For shell scripts on Linux/Render - use bash directly. Do not capture output to avoid large-memory buffers.
                result = subprocess.run(
                    ["bash", str(script_to_run)],
                    cwd=backend_dir,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    timeout=3600,  # 1 hour timeout for Render
                    env=env
                )
            
            logger.info(f"Script execution completed with return code: {result.returncode}")
            
            # Output already streamed to logs; avoid logging full buffers here
            
            # Check for generated content (regardless of return code, some scripts may have warnings but still generate files)
            generated_files = []
            output_dir = UPLOAD_DIR

            # Look for files directly under root
            if output_dir.exists():
                for file_path in output_dir.glob("*"):
                    if file_path.is_file() and file_path.suffix in ['.txt', '.docx', '.pdf', '.pptx']:
                        generated_files.append({
                            "name": file_path.name,
                            "path": str(file_path),
                            "size": file_path.stat().st_size
                        })

            # Also scan known subdirectories used by generators
            for sub in ["course material", "quizzes", "ppts", "flashcards"]:
                subdir = output_dir / sub
                if not subdir.exists():
                    continue
                for file_path in subdir.glob("*"):
                    if file_path.is_file() and file_path.suffix in ['.txt', '.docx', '.pdf', '.pptx']:
                        generated_files.append({
                            "name": file_path.name,
                            "path": str(file_path),
                            "size": file_path.stat().st_size
                        })
            
            # Consider success if return code is 0 OR files were generated
            success = result.returncode == 0 or len(generated_files) > 0
            
            if success:
                # Backup the generated files immediately
                backup_generated_files()
                
                # Write completion marker
                try:
                    marker = UPLOAD_DIR / "generation_complete.json"
                    with open(marker, "w", encoding="utf-8") as f:
                        json.dump({
                            "completed": True,
                            "completed_at": datetime.now().isoformat(),
                            "files_generated": len(generated_files),
                            "backup_created": True
                        }, f)
                except Exception as e:
                    logger.warning(f"Failed to write generation_complete.json: {e}")
                    
                return JSONResponse(
                    status_code=200,
                    content={
                        "message": "Script execution completed successfully!",
                        "generated_files": generated_files,
                        "total_files": len(generated_files),
                        "process_completed": True,
                        "return_code": result.returncode,
                        "backup_created": True
                    }
                )
            else:
                return JSONResponse(
                    status_code=500,
                    content={
                        "message": f"Script execution failed (return code: {result.returncode})",
                        "generated_files": generated_files,
                        "total_files": len(generated_files),
                        "process_completed": False,
                        "return_code": result.returncode
                    }
                )
            
        except Exception as e:
            logger.error(f"Script execution error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Script execution failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error in generate_content: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/")
async def get_status():
    """
    Get the current status of the system
    """
    try:
        config_exists = Path("user_config.json").exists()
        pdf_exists = (UPLOAD_DIR / "curriculum.pdf").exists()
        
        status = {
            "config_uploaded": config_exists,
            "curriculum_uploaded": pdf_exists,
            "ready_for_generation": config_exists and pdf_exists
        }
        
        if config_exists:
            with open("user_config.json", 'r', encoding='utf-8') as f:
                status["user_config"] = json.load(f)
        
        return status
        
    except Exception as e:
        logger.error(f"Error in get_status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/generated-files/")
async def get_generated_files():
    """
    Get list of generated files
    """
    try:
        generated_files = []
        output_dir = UPLOAD_DIR
        
        if output_dir.exists():
            for file_path in output_dir.glob("*"):
                if file_path.is_file() and file_path.suffix in ['.txt', '.docx', '.pdf', '.pptx']:
                    generated_files.append({
                        "name": file_path.name,
                        "path": str(file_path),
                        "size": file_path.stat().st_size,
                        "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                    })
        
        return {
            "files": generated_files,
            "total": len(generated_files)
        }
        
    except Exception as e:
        logger.error(f"Error in get_generated_files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Use PORT environment variable for Render, fallback to 5000
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)

# ----------------------
# Additional Content APIs
# ----------------------

def _safe_category_to_dir(category: str) -> Path:
    """Map category to a safe subdirectory under 'Inputs and Outputs'."""
    mapping = {
        "course-material": "course material",
        "quizzes": "quizzes",
        "ppts": "ppts",
        "flashcards": "flashcards",
    }
    sub = mapping.get(category)
    if not sub:
        raise HTTPException(status_code=400, detail="Invalid category")
    return UPLOAD_DIR / sub

def _list_files_in_dir(directory: Path) -> List[Dict]:
    """List files in directory with detailed information and fallback to backup"""
    items: List[Dict] = []
    
    # First try the main directory
    if directory.exists():
        for p in directory.iterdir():
            if p.is_file():
                try:
                    items.append({
                        "name": p.name,
                        "size": p.stat().st_size,
                        "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                        "ext": p.suffix.lower(),
                    })
                except Exception:
                    continue
    
    # If no files found in main directory, try backup
    if not items:
        # Determine backup path based on directory type
        if directory.name in CATEGORIES:
            backup_path = BACKUP_DIR / directory.name
        else:
            backup_path = BACKUP_DIR
            
        if backup_path.exists():
            logger.info(f"No files in main directory, checking backup: {backup_path}")
            for p in backup_path.iterdir():
                if p.is_file():
                    try:
                        # Restore file to main directory
                        main_file_path = directory / p.name
                        shutil.copy2(p, main_file_path)
                        
                        items.append({
                            "name": p.name,
                            "size": p.stat().st_size,
                            "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                            "ext": p.suffix.lower(),
                        })
                        logger.info(f"Restored and listed file: {p.name}")
                    except Exception as e:
                        logger.warning(f"Error restoring backup file {p.name}: {e}")
                        continue
    
    # sort newest first
    items.sort(key=lambda x: x["modified"], reverse=True)
    return items

@app.get("/generation/status")
async def generation_status():
    """Return whether generation has completed, by checking a marker file."""
    marker = UPLOAD_DIR / "generation_complete.json"
    if marker.exists():
        try:
            with open(marker, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"completed": bool(data.get("completed", False)), "completed_at": data.get("completed_at")}
        except Exception:
            return {"completed": True, "completed_at": None}
    return {"completed": False, "completed_at": None}

@app.get("/course-material/preview")
async def get_course_material_preview():
    """
    Return text content preview from the most recent .txt in 'Inputs and Outputs/course material'.
    Fallback to any .txt in 'Inputs and Outputs' if none found.
    """
    # Prefer course material folder
    cm_dir = _safe_category_to_dir("course-material")
    candidates: List[Path] = []
    if cm_dir.exists():
        candidates += list(cm_dir.glob("*.txt"))
    # Fallback: any txt in root UPLOAD_DIR
    candidates += list(UPLOAD_DIR.glob("*.txt"))
    if not candidates:
        # Return empty preview gracefully instead of 404
        return {"file": None, "path": None, "preview": ""}
    # pick latest by mtime
    latest = max(candidates, key=lambda p: p.stat().st_mtime)
    try:
        text = latest.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read preview: {e}")
    return {"file": latest.name, "path": str(latest), "preview": text}

@app.get("/debug/info")
async def debug_info():
    """Debug endpoint to check system status"""
    try:
        return {
            "upload_dir_exists": UPLOAD_DIR.exists(),
            "backup_dir_exists": BACKUP_DIR.exists(),
            "upload_dir_contents": list(str(p) for p in UPLOAD_DIR.glob("**/*") if p.is_file()) if UPLOAD_DIR.exists() else [],
            "backup_dir_contents": list(str(p) for p in BACKUP_DIR.glob("**/*") if p.is_file()) if BACKUP_DIR.exists() else [],
            "categories": CATEGORIES,
            "config_exists": Path("user_config.json").exists(),
            "curriculum_exists": (UPLOAD_DIR / "curriculum.pdf").exists(),
            "generation_marker_exists": (UPLOAD_DIR / "generation_complete.json").exists(),
            "environment": {
                "gemini_key_set": bool(os.environ.get("GEMINI_API_KEY")),
                "cors_origins": os.environ.get("BACKEND_CORS_ORIGINS", "not_set"),
                "platform": platform.system(),
            }
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/files/{category}")
async def list_category_files(category: str):
    """
    List files for a given category: course-material | quizzes | ppts | flashcards
    """
    try:
        directory = _safe_category_to_dir(category)
        files = _list_files_in_dir(directory)
        
        return {
            "category": category, 
            "directory": str(directory), 
            "files": files, 
            "total": len(files),
            "backup_checked": len(files) > 0,
            "debug": {
                "directory_exists": directory.exists(),
                "backup_dir": str(BACKUP_DIR / directory.name) if directory.name in CATEGORIES else str(BACKUP_DIR)
            }
        }
    except Exception as e:
        logger.error(f"Error listing files for category {category}: {e}")
        return {
            "category": category,
            "directory": "error",
            "files": [],
            "total": 0,
            "error": str(e)
        }

@app.get("/download/{category}/{filename}")
async def download_file(category: str, filename: str):
    """Download a file by category and filename."""
    if "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    directory = _safe_category_to_dir(category)
    file_path = directory / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=str(file_path), filename=filename)

def _slugify(name: str) -> str:
    base = Path(name).stem
    return "-".join(base.strip().lower().replace("_", " ").split())

@app.get("/courses")
async def list_courses():
    """Group generated content into courses based on files in 'course material'."""
    cm_dir = _safe_category_to_dir("course-material")
    if not cm_dir.exists():
        return {"courses": [], "total": 0}
    courses: Dict[str, Dict] = {}
    # Identify courses from course material files (txt/docx/pdf)
    for p in cm_dir.iterdir():
        if p.is_file() and p.suffix.lower() in [".txt", ".docx", ".pdf"]:
            stem = p.stem
            slug = _slugify(stem)
            info = courses.setdefault(slug, {
                "slug": slug,
                "title": stem,
                "updated": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                "categories": {"course-material": 0, "quizzes": 0, "ppts": 0, "flashcards": 0},
            })
            info["categories"]["course-material"] += 1
            # Track latest update
            ts = datetime.fromtimestamp(p.stat().st_mtime).isoformat()
            if ts > info["updated"]:
                info["updated"] = ts
    # Count across other categories by prefix match
    for cat in ["quizzes", "ppts", "flashcards"]:
        d = _safe_category_to_dir(cat)
        if not d.exists():
            continue
        for p in d.iterdir():
            if not p.is_file():
                continue
            stem = p.stem
            # attempt to map to a known course by checking if any course title is a prefix of stem
            for slug, info in courses.items():
                title_stem = info["title"]
                if stem.lower().startswith(title_stem.lower()):
                    info["categories"][cat] += 1
                    ts = datetime.fromtimestamp(p.stat().st_mtime).isoformat()
                    if ts > info["updated"]:
                        info["updated"] = ts
                    break
    list_courses_resp = sorted(courses.values(), key=lambda x: x["updated"], reverse=True)
    return {"courses": list_courses_resp, "total": len(list_courses_resp)}

@app.get("/courses/{slug}")
async def course_detail(slug: str):
    """Return files per category for the given course slug."""
    # Find matching course title from slug by scanning course material
    cm_dir = _safe_category_to_dir("course-material")
    if not cm_dir.exists():
        raise HTTPException(status_code=404, detail="No courses available")
    title = None
    for p in cm_dir.iterdir():
        if p.is_file():
            if _slugify(p.stem) == slug:
                title = p.stem
                break
    if not title:
        raise HTTPException(status_code=404, detail="Course not found")

    def collect(cat: str) -> List[Dict]:
        dirp = _safe_category_to_dir(cat)
        out: List[Dict] = []
        if not dirp.exists():
            return out
        for f in dirp.iterdir():
            if f.is_file() and f.stem.lower().startswith(title.lower()):
                out.append({
                    "name": f.name,
                    "size": f.stat().st_size,
                    "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                    "ext": f.suffix.lower(),
                    "download_url": f"/download/{cat}/{f.name}",
                })
        out.sort(key=lambda x: x["modified"], reverse=True)
        return out

    result = {
        "slug": slug,
        "title": title,
        "course_material": collect("course-material"),
        "quizzes": collect("quizzes"),
        "ppts": collect("ppts"),
        "flashcards": collect("flashcards"),
    }
    return result
