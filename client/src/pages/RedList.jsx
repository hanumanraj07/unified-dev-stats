import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../components/ToastContext";
import { profileApi } from "../services/api";

function RedList() {
  const [redList, setRedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const { pushToast } = useToast();

  const loadRedList = async () => {
    setLoading(true);
    try {
      const data = await profileApi.getRedList();
      setRedList(data.redList || []);
    } catch (error) {
      pushToast(error.response?.data?.message || "Could not load red list.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRedList();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Red List</h1>
        <button type="button" className="btn-secondary" onClick={loadRedList}>
          Refresh
        </button>
      </div>

      <p className="text-slate-400">
        Students who have not increased their score by at least 5 points in the last 24 hours.
      </p>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : redList.length === 0 ? (
        <div className="panel">
          <p className="text-slate-400">No students in red list. All students are progressing well!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {redList.map((student) => (
            <div
              key={student._id}
              className="panel flex items-center justify-between border-red-500/50 bg-red-500/5"
            >
              <div>
                <Link to={`/student-dashboard/${student.username}`} className="font-semibold text-white hover:text-accentBlue">
                  {student.name}
                </Link>
                <p className="text-xs text-slate-400">@{student.username}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-300">
                  Score: {student.devScore}
                </p>
                <p className="text-xs text-red-400">
                  Previous: {student.previousDevScore}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RedList;
