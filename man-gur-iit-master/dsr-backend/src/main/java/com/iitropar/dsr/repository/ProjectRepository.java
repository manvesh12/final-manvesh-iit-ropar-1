package com.iitropar.dsr.repository;
import com.iitropar.dsr.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByCreatedBy(Long createdBy);

    @Transactional
    @Modifying
    @Query("DELETE FROM WorkflowHistory h WHERE h.reportId IN (SELECT r.id FROM Report r WHERE r.projectId = ?1)")
    void deleteWorkflowHistoryByProjectId(Long projectId);

    @Transactional
    @Modifying
    @Query("DELETE FROM Report r WHERE r.projectId = ?1")
    void deleteReportsByProjectId(Long projectId);

    @Transactional
    @Modifying
    @Query("DELETE FROM Comment c WHERE c.section.project.id = ?1")
    void deleteCommentsByProjectId(Long projectId);

    @Transactional
    @Modifying
    @Query("DELETE FROM DSRFile f WHERE f.section.project.id = ?1")
    void deleteDSRFilesByProjectId(Long projectId);

    @Transactional
    @Modifying
    @Query("DELETE FROM Section s WHERE s.project.id = ?1")
    void deleteSectionsByProjectId(Long projectId);

    @Transactional
    @Modifying
    @Query("DELETE FROM Approval a WHERE a.project.id = ?1")
    void deleteApprovalsByProjectId(Long projectId);
}
