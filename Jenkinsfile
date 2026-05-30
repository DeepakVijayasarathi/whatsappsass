pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        IMAGE_NAME     = "whatsappsass"
        CONTAINER_NAME = "whatsappsass-container"

        FRONTEND_PORT  = "9100"
        BACKEND_PORT   = "4000"

        REPO_URL  = "https://github.com/DeepakVijayasarathi/whatsappsass.git"
        BRANCH    = "main"

        NODE_ENV      = "production"
        FRONTEND_URL  = "http://5.223.64.206:9100"
        BACKEND_URL   = "http://127.0.0.1:4000"

        DATABASE_URL  = "postgresql://admin:ScaleLite2026XkP9mNqR@5.223.64.206:5432/appdb"
        JWT_SECRET    = "ScaleLite2026XkP9mNqR-jwt-secret-change-me"
    }

    stages {

        stage('Clean Workspace') {
            steps {
                deleteDir()
            }
        }

        stage('Clone Repository') {
            steps {
                git branch: "${BRANCH}",
                    url: "${REPO_URL}",
                    credentialsId: 'git'
            }
        }

        stage('Verify Structure') {
            steps {
                sh '''
                ls -la
                ls -la apps || true
                ls -la packages || true
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build --no-cache -t $IMAGE_NAME .'
            }
        }

        stage('Run Container') {
            steps {
                sh '''
                echo "Stopping old container..."
                docker stop $CONTAINER_NAME || true
                docker rm $CONTAINER_NAME || true

                echo "Starting new container..."
                docker run -d \
                  --name $CONTAINER_NAME \
                  --restart=always \
                  -p $FRONTEND_PORT:3000 \
                  -p $BACKEND_PORT:$BACKEND_PORT \
                  -e FRONTEND_PORT=3000 \
                  -e BACKEND_PORT=$BACKEND_PORT \
                  -e BACKEND_URL="$BACKEND_URL" \
                  -e FRONTEND_URL="$FRONTEND_URL" \
                  -e DATABASE_URL="$DATABASE_URL" \
                  -e JWT_SECRET="$JWT_SECRET" \
                  -e NODE_ENV="$NODE_ENV" \
                  $IMAGE_NAME
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                sleep 20

                echo "=== RUNNING CONTAINERS ==="
                docker ps

                echo "=== APPLICATION LOGS ==="
                docker logs $CONTAINER_NAME --tail 100

                echo "=== BACKEND HEALTH CHECK ==="
                curl -sf http://localhost:4000/health && echo "Backend OK" || echo "Backend not ready"

                echo "=== FRONTEND CHECK ==="
                curl -I http://localhost:9100 || true
                '''
            }
        }

        stage('Cleanup') {
            steps {
                sh 'docker image prune -f'
            }
        }
    }

    post {
        success {
            echo "✅ WhatsApp SaaS deployed successfully"
            echo "Frontend: http://5.223.64.206:9100"
            echo "Backend:  http://5.223.64.206:4000"
        }
        failure {
            echo "❌ Deployment failed - check logs"
        }
        always {
            sh '''
            echo "=== FINAL STATUS ==="
            docker ps -a | head -20
            '''
        }
    }
}
