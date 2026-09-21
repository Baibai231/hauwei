from __future__ import annotations

import io

import pandas as pd


def test_health_and_demo_seed(client):
    assert client.get("/api/health").status_code == 200
    projects = client.get("/api/projects").json()["data"]
    assert projects
    assert projects[0]["next_action"]["title"]


def test_project_crud_and_state_machine(client):
    created = client.post("/api/projects", json={"name":"Test Project","idea":"RAG for education"})
    assert created.status_code == 200
    project = created.json()["data"]
    assert project["next_action"]["stage"] == "research_question"
    planned = client.post(f"/api/projects/{project['id']}/plan", json={}).json()["data"]
    assert len(planned["research_questions"]) == 3
    status = client.post("/api/genios/project/status", json={"project_id":project["id"]})
    assert status.status_code == 200
    assert status.json()["data"]["next_action"]["stage"] == "literature"
    assert client.delete(f"/api/projects/{project['id']}").status_code == 200


def test_literature_add_update_and_evidence(client):
    project_id = client.get("/api/projects").json()["data"][0]["id"]
    paper = client.post(f"/api/projects/{project_id}/papers", json={
        "title":"Test Evidence Paper", "authors":["A. Researcher"], "year":2026,
        "abstract":"We propose a method. The result improves recall on the benchmark dataset.",
        "source":"test", "full_text":"Introduction\nWe study a problem.\nMethod\nWe propose a method.\nResults\nThe result improves recall on the benchmark dataset."
    }).json()["data"]
    updated = client.patch(f"/api/papers/{paper['id']}", json={"is_core":True,"status":"read"}).json()["data"]
    assert updated["is_core"] is True
    evidence = client.post(f"/api/projects/{project_id}/evidence/extract", json={"paper_id":paper["id"]})
    assert evidence.status_code == 200
    assert evidence.json()["data"]["paper_id"] == paper["id"]
    evidence_id = evidence.json()["data"]["id"]
    claim = client.post(f"/api/projects/{project_id}/claims", json={"text":"The method improves recall.","evidence_id":evidence_id,"stance":"supporting"})
    assert claim.status_code == 200
    assert claim.json()["data"]["links"][0]["paper_id"] == paper["id"]


def test_data_analysis(client):
    project_id = client.get("/api/projects").json()["data"][0]["id"]
    data = pd.DataFrame({"baseline":[.4,.5,.6,.7],"rag":[.55,.62,.72,.8]}).to_csv(index=False).encode()
    response = client.post(f"/api/projects/{project_id}/analysis", files={"file":("results.csv",io.BytesIO(data),"text/csv")})
    assert response.status_code == 200
    result = response.json()["data"]
    assert result["overview"]["rows"] == 4
    assert result["charts"]


def test_all_genios_tools_are_documented(client):
    schema = client.get("/openapi.json").json()
    expected = ["/api/genios/project/create","/api/genios/project/status","/api/genios/research/plan","/api/genios/literature/search","/api/genios/literature/add","/api/genios/paper/parse","/api/genios/paper/ask","/api/genios/evidence/extract","/api/genios/gap/analyze","/api/genios/research/design","/api/genios/data/analyze","/api/genios/writing/draft","/api/genios/project/next-action"]
    assert all(path in schema["paths"] for path in expected)
