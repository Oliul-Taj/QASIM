"""
Model Trainer Wrapper for Connectiva
Handles subprocess-based model retraining with progress tracking
"""

import subprocess
import threading
import os
import json
from datetime import datetime
from pathlib import Path


class ModelTrainerJob:
    """Encapsulates a single model training job"""
    
    def __init__(self, job_id, input_file=None):
        self.job_id = job_id
        self.input_file = input_file  # Path to new data CSV
        self.status = "queued"  # queued, running, completed, failed
        self.progress = 0  # 0-100
        self.output_model = None
        self.output_metrics = None
        self.error_message = None
        self.start_time = None
        self.end_time = None
        self.process = None
        
    def to_dict(self):
        return {
            "job_id": self.job_id,
            "status": self.status,
            "progress": self.progress,
            "output_model": self.output_model,
            "output_metrics": self.output_metrics,
            "error_message": self.error_message,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "elapsed_seconds": (datetime.fromisoformat(self.end_time) - datetime.fromisoformat(self.start_time)).total_seconds() if self.end_time and self.start_time else None
        }


class ModelTrainer:
    """Manages model training jobs"""
    
    def __init__(self):
        self.jobs = {}  # job_id -> ModelTrainerJob
        self.job_counter = 0
        self.training_script = os.path.join(
            os.path.dirname(__file__), "..", "..", "files", "ML", "train_connectiva_v4.py"
        )
        
    def create_job(self, input_file=None):
        """Create a new training job"""
        self.job_counter += 1
        job_id = f"train_{self.job_counter}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        job = ModelTrainerJob(job_id, input_file)
        self.jobs[job_id] = job
        return job_id
    
    def get_job(self, job_id):
        """Fetch job status"""
        return self.jobs.get(job_id)
    
    def start_training(self, job_id):
        """Start training on new thread"""
        job = self.jobs.get(job_id)
        if not job:
            return {"status": "error", "message": "Job not found"}
        
        if job.status != "queued":
            return {"status": "error", "message": f"Job already {job.status}"}
        
        # Launch in background thread
        thread = threading.Thread(target=self._run_training, args=(job,))
        thread.daemon = True
        thread.start()
        
        return {"status": "started", "job_id": job_id, "message": "Training job started"}
    
    def _run_training(self, job):
        """Execute training subprocess"""
        job.status = "running"
        job.progress = 0
        job.start_time = datetime.now().isoformat()
        
        try:
            # Prepare command
            cmd = ["python", self.training_script]
            if job.input_file:
                cmd.extend(["--input", job.input_file])
            
            # Run training
            job.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=os.path.dirname(self.training_script)
            )
            
            # Monitor progress from stdout
            for line in job.process.stdout:
                line = line.strip()
                if "progress:" in line.lower():
                    try:
                        progress = int(''.join(filter(str.isdigit, line)))
                        job.progress = min(100, progress)
                    except:
                        pass
            
            job.process.wait()
            
            if job.process.returncode == 0:
                job.status = "completed"
                job.progress = 100
                job.output_model = os.path.join(
                    os.path.dirname(self.training_script),
                    "model_output_v4",
                    "connectiva_v4_model.pkl"
                )
                job.output_metrics = os.path.join(
                    os.path.dirname(self.training_script),
                    "model_output_v4",
                    "model_metrics_v4.json"
                )
            else:
                job.status = "failed"
                stderr = job.process.stderr.read() if job.process.stderr else "Unknown error"
                job.error_message = stderr[:500]  # First 500 chars
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)[:200]
        finally:
            job.end_time = datetime.now().isoformat()
    
    def cancel_job(self, job_id):
        """Cancel ongoing training"""
        job = self.jobs.get(job_id)
        if not job:
            return {"status": "error", "message": "Job not found"}
        
        if job.process:
            try:
                job.process.terminate()
                job.status = "cancelled"
                return {"status": "cancelled", "job_id": job_id}
            except:
                return {"status": "error", "message": "Could not terminate process"}
        
        return {"status": "error", "message": "No active process"}


# Export for use in app.py
trainer = ModelTrainer()

