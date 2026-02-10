import { exec } from "child_process";
import path from "path";
import express from "express";
import fs from "fs";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";

const app = express();
const PORT = 9000;

app.use(cors({
  origin:"https://savebiss.vercel.app",
  methods:["GET","POST"],
  allowedHeaders:['Content-Type,Authorization']
}));

app.use(express.json());

/* ---------------- JOB STORE ---------------- */
const jobs = {}; 
// jobId: { status: "processing" | "done" | "error", output: string }

/* ---------------- MULTER ---------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./"),
  filename: (req, file, cb) => {
    const jobId = req.jobId;
    cb(null, `input-${jobId}.mp4`);
  },
});

const upload = multer({ storage });

app.get("/", (req, res) => {
  return res.json({ msg: "Welcomeeeeeeeee" });
});

/* ---------------- UPLOAD ---------------- */
app.post(
  "/getvideo/sendVideo",
  (req, res, next) => {
    req.jobId = crypto.randomUUID();
    next();
  },
  upload.single("file"),
  async (req, res) => {
    const jobId = req.jobId;
    const inputPath = `input-${jobId}.mp4`;
    const outputPath = `output-${jobId}.mp4`;

    jobs[jobId] = { status: "processing" };

    const command = `
      ffmpeg -i ${inputPath} \
      -vf "drawtext=fontfile=font.ttf:fontsize=80:fontcolor=red@0.5:text=userid1345:
      x=if(eq(mod(t\\,2)\\,0)\\,rand(0\\,(W-tw))\\,x):
      y=if(eq(mod(t\\,3)\\,0)\\,rand(0\\,(H-th))\\,y)" \
      -c:v libx264 -crf 23 -c:a copy ${outputPath}
    `;

    exec(command, (error) => {
      if (error) {
        jobs[jobId].status = "error";
        return;
      }
      jobs[jobId] = {
        status: "done",
        output: outputPath,
      };
    });

    res.json({
      msg: "Video uploaded, processing started",
      jobId,
    });
  }
);

/* ---------------- POLLING ---------------- */
app.get("/pooling/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];

  if (!job) {
    return res.status(404).json({ msg: "Invalid job id" });
  }

  if (job.status === "processing") {
    return res.status(202).json({ status: "processing" });
  }

  if (job.status === "error") {
    return res.status(500).json({ status: "error" });
  }

  res.sendFile(path.resolve(job.output), () => {
    setTimeout(() => {
      fs.unlink(`input-${jobId}.mp4`, () => {});
      fs.unlink(`output-${jobId}.mp4`, () => {});
      delete jobs[jobId];
    }, 5000);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
